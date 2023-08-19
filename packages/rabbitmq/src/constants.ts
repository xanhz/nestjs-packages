import { Options } from 'amqplib';
import { RabbitClientDeserializer, RabbitServerDeserializer } from './deserializer';
import { ChannelConfig } from './interfaces';
import { RabbitClientSerializer, RabbitServerSerializer } from './serializer';

export const RABBIT_TRANSPORTER = Symbol('RABBIT_TRANSPORTER');

export const DEFAULT_CONNECTION = 'default';
export const DEFAULT_URL = 'amqp://guest:guest@localhost:5672';
export const DEFAULT_MANUAL_ACK = false;
export const DEFAULT_CHANNEL: ChannelConfig = {
  name: 'default',
  prefetchCount: 0,
};
export const DEFAULT_REPLY_QUEUE = 'amq.rabbitmq.reply-to';
export const DEFAULT_CONSUME_OPTIONS: Options.Consume = {
  noAck: true,
};

export const DEFAULT_SERVER_SERIALIZER = new RabbitServerSerializer();
export const DEFAULT_SERVER_DESERIALIZER = new RabbitServerDeserializer();

export const DEFAULT_CLIENT_SERIALIZER = new RabbitClientSerializer();
export const DEFAULT_CLIENT_DESERIALIZER = new RabbitClientDeserializer();
