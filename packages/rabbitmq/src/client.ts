import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ClientProxy,
  Deserializer,
  IncomingResponse,
  ReadPacket,
  Serializer,
  WritePacket,
} from '@nestjs/microservices';
import { ConfirmChannel, Connection, ConsumeMessage, Options, connect as createRabbitConnection } from 'amqplib';
import * as Bluebird from 'bluebird';
import { EventEmitter } from 'node:events';
import { Observable } from 'rxjs';
import {
  DEFAULT_CLIENT_DESERIALIZER,
  DEFAULT_CLIENT_SERIALIZER,
  DEFAULT_CONSUME_OPTIONS,
  DEFAULT_REPLY_QUEUE,
  DEFAULT_URL,
} from './constants';
import { InvalidPublishOptions } from './errors';
import { ExchangeConfig, PublishOptions, RabbitClientOptions } from './interfaces';
import { isNil, isPublishOptions, randomID } from './utils';

export class RabbitClient extends ClientProxy implements OnModuleInit {
  protected static readonly logger = new Logger(RabbitClient.name);

  protected readonly url: string;
  protected readonly replyQueue: string;
  protected readonly queueOptions: Options.AssertQueue;
  protected readonly consumeOptions: Options.Consume;
  protected readonly responseEmitter: EventEmitter;
  protected readonly exchanges: ExchangeConfig[];
  protected override readonly serializer: Serializer<ReadPacket, Buffer>;
  protected override readonly deserializer: Deserializer<ConsumeMessage, IncomingResponse>;
  protected connection!: Connection;
  protected channel!: ConfirmChannel;

  constructor(protected readonly options: RabbitClientOptions) {
    super();
    this.url = options?.url ?? DEFAULT_URL;
    this.replyQueue = options?.replyQueue ?? DEFAULT_REPLY_QUEUE;
    this.queueOptions = options?.queueOptions ?? {};
    this.consumeOptions = options?.consumeOptions ?? DEFAULT_CONSUME_OPTIONS;
    this.exchanges = options?.exchanges ?? [];
    this.deserializer = options?.deserializer ?? DEFAULT_CLIENT_DESERIALIZER;
    this.serializer = options?.serializer ?? DEFAULT_CLIENT_SERIALIZER;
    this.responseEmitter = new EventEmitter();
    this.responseEmitter.setMaxListeners(Infinity);
    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public onModuleInit() {
    return this.connect();
  }

  public async connect(): Promise<any> {
    if (this.connection) {
      return;
    }

    RabbitClient.logger.log(`Connecting to ${this.url}`);
    this.connection = await createRabbitConnection(this.url);

    RabbitClient.logger.log(`Creating channel`);
    this.channel = await this.connection.createConfirmChannel();

    await Bluebird.mapSeries(this.exchanges, (exchange) => {
      const { name, type = 'direct', ...options } = exchange;
      RabbitClient.logger.log(`Asserting exchange='${name}' | Type='${type}'`);
      return this.channel.assertExchange(name, type, options);
    });

    RabbitClient.logger.log(`Asserting queue='${this.replyQueue}'`);
    await this.channel.assertQueue(this.replyQueue, this.queueOptions);

    RabbitClient.logger.log(`Start consuming on queue='${this.replyQueue}'`);
    await this.channel.consume(
      this.replyQueue,
      (msg) => this.responseEmitter.emit(msg?.properties.correlationId, msg),
      this.consumeOptions,
    );
  }

  public async close() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  protected publish(packet: ReadPacket<any>, callback: (packet: WritePacket<any>) => void): () => void {
    try {
      const { pattern } = packet;
      const { exchange = null, routingKey = '', queue = null, ...rest } = pattern as PublishOptions;

      if (isNil(exchange) && isNil(queue)) {
        throw new InvalidPublishOptions();
      }

      const buffer = this.serializer.serialize(packet);
      const options = Object.assign(rest, { correlationId: randomID(), replyTo: this.replyQueue });

      const listener = (msg: ConsumeMessage) => this.subscribe(msg, callback);
      this.responseEmitter.on(options.correlationId, listener);

      if (exchange) {
        this.publishToExchange(exchange, routingKey, buffer, options).catch((err) => callback({ err }));
      } else {
        this.publishToQueue(queue as string, buffer, options).catch((err) => callback({ err }));
      }

      return () => this.responseEmitter.removeListener(options.correlationId, listener);
    } catch (err) {
      callback({ err });
      return () => void 0;
    }
  }

  protected async subscribe(msg: ConsumeMessage, callback: (packet: WritePacket<any>) => void) {
    const { err, isDisposed, response } = await this.deserializer.deserialize(msg);
    if (isDisposed || err) {
      return callback({ err, isDisposed, response });
    }
    return callback({ err, response });
  }

  protected dispatchEvent(packet: ReadPacket<any>): Promise<any> {
    const { pattern } = packet;
    const { exchange = null, routingKey = '', queue = null, ...options } = pattern as PublishOptions;

    if (isNil(exchange) && isNil(queue)) {
      throw new InvalidPublishOptions();
    }

    const buffer = this.serializer.serialize(packet);

    if (exchange) {
      return this.publishToExchange(exchange, routingKey, buffer, options);
    }

    return this.publishToQueue(queue as string, buffer, options);
  }

  protected publishToExchange(exchange: string, routingKey: string, buffer: Buffer, options?: Options.Publish) {
    return new Promise((resolve, reject) => {
      this.channel.publish(exchange, routingKey, buffer, options, (error, ok) => {
        return error ? reject(error) : resolve(ok);
      });
    });
  }

  protected publishToQueue(queue: string, buffer: Buffer, options: Options.Publish) {
    return new Promise((resolve, reject) => {
      this.channel.sendToQueue(queue, buffer, options, (error, ok) => {
        return error ? reject(error) : resolve(ok);
      });
    });
  }

  public override emit<TResult = any, TInput = any>(options: PublishOptions, data: TInput): Observable<TResult> {
    if (!isPublishOptions(options)) {
      throw new InvalidPublishOptions();
    }
    return super.emit(options, data);
  }

  public override send<TResult = any, TInput = any>(options: PublishOptions, data: TInput): Observable<TResult> {
    if (!isPublishOptions(options)) {
      throw new InvalidPublishOptions();
    }
    return super.send(options, data);
  }
}
