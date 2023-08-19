import { uid } from 'uid';
import { HandlerOptions, PublishOptions } from './interfaces';

export { isNil, isObject, isString, isUndefined } from '@nestjs/common/utils/shared.utils';

export function isHandlerOptions(options: any): options is HandlerOptions {
  return typeof options === 'object' && 'queue' in options;
}

export function isPublishOptions(options: any): options is PublishOptions {
  return typeof options === 'object' && ('queue' in options || 'exchange' in options);
}

export function randomID(length = 11) {
  return uid(length);
}
