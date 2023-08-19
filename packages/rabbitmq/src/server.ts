import { Logger } from '@nestjs/common';
import {
  CustomTransportStrategy,
  Deserializer,
  IncomingEvent,
  MessageHandler,
  OutgoingResponse,
  Serializer,
  Server,
} from '@nestjs/microservices';
import { ConfirmChannel, Connection, ConsumeMessage, connect as createRabbitConnection } from 'amqplib';
import * as Bluebird from 'bluebird';
import {
  DEFAULT_CHANNEL,
  DEFAULT_CONNECTION,
  DEFAULT_MANUAL_ACK,
  DEFAULT_SERVER_DESERIALIZER,
  DEFAULT_SERVER_SERIALIZER,
  DEFAULT_URL,
  RABBIT_TRANSPORTER,
} from './constants';
import { RabbitContext } from './context';
import { HandlerOptions, RPCOptions, RabbitHandler, RabbitServerOptions } from './interfaces';
import { isHandlerOptions, isNil } from './utils';

export class RabbitServer extends Server implements CustomTransportStrategy {
  protected static readonly logger = new Logger(RabbitServer.name)

  public readonly transportId: symbol;
  protected readonly name: string;
  protected readonly url: string;
  protected readonly manualAck: boolean;
  protected readonly channels: Map<string, ConfirmChannel>;
  protected override readonly messageHandlers!: Map<string, RabbitHandler>;
  protected override readonly deserializer: Deserializer<ConsumeMessage, IncomingEvent>;
  protected override readonly serializer: Serializer<OutgoingResponse, Buffer>;
  protected connection!: Connection;

  constructor(protected readonly options: RabbitServerOptions) {
    super();
    this.transportId = RABBIT_TRANSPORTER;
    this.name = options?.name ?? DEFAULT_CONNECTION;
    this.url = options?.url ?? DEFAULT_URL;
    this.manualAck = options?.manualAck ?? DEFAULT_MANUAL_ACK;
    this.channels = new Map();
    this.deserializer = options?.deserializer ?? DEFAULT_SERVER_DESERIALIZER;
    this.serializer = options?.serializer ?? DEFAULT_SERVER_SERIALIZER;
  }

  public async listen(callback: (...args: any[]) => any) {
    try {
      await this.setupConnection();
      await this.setupChannels();
      await this.setupExchanges();
      await this.setupConsumers();
      callback();
    } catch (error) {
      callback(error);
    }
  }

  protected async setupConnection() {
    RabbitServer.logger.log(`Connecting to ${this.url}`);
    this.connection = await createRabbitConnection(this.url);
  }

  protected async setupChannels() {
    const _channels = this.getOptionsProp(this.options, 'channels') ?? [];
    _channels.push(DEFAULT_CHANNEL);
    return Bluebird.mapSeries(_channels, async (config) => {
      const { name, prefetchCount = 0 } = config;
      RabbitServer.logger.log(`Creating channel=${name} | prefetch=${prefetchCount}`);
      const channel = await this.connection.createConfirmChannel();
      await channel.prefetch(prefetchCount);
      this.channels.set(name, channel);
    });
  }

  protected setupExchanges() {
    const channels = this.channels.values();
    const _exchanges = this.getOptionsProp(this.options, 'exchanges') ?? [];
    return Bluebird.mapSeries(_exchanges, (config) => {
      const { name, type = 'direct', ...options } = config;
      RabbitServer.logger.log(`Asserting exchange=${name} | type=${type}`);
      return Bluebird.mapSeries(channels, (channel) => channel.assertExchange(name, type, options));
    });
  }

  protected setupConsumers() {
    return Bluebird.mapSeries(this.messageHandlers.keys(), async (pattern) => {
      const handlerOptions: HandlerOptions = JSON.parse(pattern);
      const {
        queue,
        queueOptions,
        channel = 'default',
        consumeOptions = {},
        exchange = null,
        routingKey = '',
      } = handlerOptions;

      const _channel = this.channels.get(channel);
      if (!_channel) return;

      RabbitServer.logger.log(`Asserting queue=${queue} in channel=${channel}`);
      await _channel.assertQueue(queue, queueOptions);

      if (exchange) {
        RabbitServer.logger.log(`Binding queue=${queue} to exchange=${exchange} with routingKey=${routingKey}`);
        await _channel.bindQueue(queue, exchange, routingKey);
      }

      _channel.consume(queue, (msg) => this.consumeMessage(_channel, pattern, msg as ConsumeMessage), {
        noAck: !this.manualAck,
        ...consumeOptions,
      });
    });
  }

  protected async consumeMessage(channel: ConfirmChannel, pattern: string, rawMsg: ConsumeMessage) {
    if (isNil(rawMsg)) return;

    const packet = await this.deserializer.deserialize(rawMsg);
    const ctx = new RabbitContext([channel, packet.data, rawMsg]);
    const handler = this.getHandlerByPattern(pattern);

    const isEventHandler = handler.isEventHandler;
    if (isEventHandler) {
      return this.handleEvent(pattern, packet, ctx);
    }

    const response$ = this.transformToObservable(handler(packet.data, ctx));
    if (!response$) return;

    return this.send(response$, async (data: any) => {
      const { replyOptions } = JSON.parse(pattern) as RPCOptions;
      const { correlationId, replyTo } = rawMsg.properties;
      const buffer = this.serializer.serialize(data);
      channel.sendToQueue(replyTo, buffer, { ...replyOptions, correlationId });
    });
  }

  public async close() {
    const channels = this.channels.values();
    await Bluebird.mapSeries(channels, (channel) => channel.close());
    await this.connection.close();
  }

  public override addHandler(options: HandlerOptions, callback: MessageHandler, isEventHandler?: boolean): void {
    if (!isHandlerOptions(options)) {
      return;
    }

    const connectionName = options['connection'] ?? DEFAULT_CONNECTION;
    if (this.name !== connectionName) {
      return;
    }

    const pattern = this.generatePattern(options);
    callback.isEventHandler = isEventHandler;

    if (this.messageHandlers.has(pattern) && isEventHandler) {
      const headRef = this.messageHandlers.get(pattern) as RabbitHandler;
      const getTail = (handler: RabbitHandler): RabbitHandler => {
        return handler?.next ? getTail(handler.next) : handler
      };

      const tailRef = getTail(headRef);
      tailRef.next = callback;
    } else {
      this.messageHandlers.set(pattern, callback);
    }
  }

  public override getHandlerByPattern(pattern: string): RabbitHandler {
    return this.messageHandlers.get(pattern) as RabbitHandler;
  }

  protected generatePattern(options: HandlerOptions): string {
    return JSON.stringify(options);
  }
}
