import { PATTERN_HANDLER_METADATA, PATTERN_METADATA, TRANSPORT_METADATA } from '@nestjs/microservices/constants';
import { PatternHandler } from '@nestjs/microservices/enums/pattern-handler.enum';
import { RPCOptions, SubscribeOptions } from './interfaces';
import { RABBIT_TRANSPORTER } from './constants';

export const RabbitSubscribe = (options: SubscribeOptions) => {
  return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(PATTERN_METADATA, [options], descriptor.value);
    Reflect.defineMetadata(PATTERN_HANDLER_METADATA, PatternHandler.EVENT, descriptor.value);
    Reflect.defineMetadata(TRANSPORT_METADATA, RABBIT_TRANSPORTER, descriptor.value);
  };
};

export const RabbitRPC = (options: RPCOptions) => {
  return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(PATTERN_METADATA, [options], descriptor.value);
    Reflect.defineMetadata(PATTERN_HANDLER_METADATA, PatternHandler.MESSAGE, descriptor.value);
    Reflect.defineMetadata(TRANSPORT_METADATA, RABBIT_TRANSPORTER, descriptor.value);
  };
};
