import {
  Deserializer,
  IncomingEvent,
  IncomingResponse,
  MessageHandler,
  OutgoingResponse,
  ReadPacket,
  Serializer,
} from '@nestjs/microservices';
import { ConsumeMessage, Options } from 'amqplib';
import { RabbitContext } from './context';

export type ExchangeType = 'direct' | 'topic' | 'headers' | 'fanout' | 'match';

export interface ChannelConfig {
  name: string;
  prefetchCount?: number;
}

export interface ExchangeConfig extends Options.AssertExchange {
  name: string;
  type?: ExchangeType;
}

export interface RabbitOptions {
  url?: string;
  exchanges?: ExchangeConfig[];
}

export interface RabbitServerOptions extends RabbitOptions {
  name?: string;
  manualAck?: boolean;
  channels?: ChannelConfig[];
  deserializer?: Deserializer<ConsumeMessage, IncomingEvent>;
  serializer?: Serializer<OutgoingResponse, Buffer>;
}

export interface RabbitClientOptions extends RabbitOptions {
  replyQueue?: string;
  queueOptions?: Options.AssertQueue;
  consumeOptions?: Options.Consume;
  deserializer?: Deserializer<ConsumeMessage, IncomingResponse>;
  serializer?: Serializer<ReadPacket, Buffer>;
}

export interface PublishOptions extends Omit<Options.Publish, 'correlationId' | 'replyTo'> {
  queue?: string;
  exchange?: string;
  routingKey?: string;
}

export interface SubscribeOptions {
  connection?: string;
  channel?: string;
  exchange?: string;
  routingKey?: string;
  queue: string;
  queueOptions?: Options.AssertQueue;
  consumeOptions?: Options.Consume;
}

export interface RPCOptions extends SubscribeOptions {
  replyOptions?: Omit<Options.Publish, 'correlationId' | 'replyTo'>;
}

export type HandlerOptions = SubscribeOptions | RPCOptions;

export type RabbitHandler = MessageHandler<any, RabbitContext, any>;
