import { OutgoingResponse, ReadPacket, Serializer } from '@nestjs/microservices';
import { isString } from './utils';

export class RabbitServerSerializer implements Serializer<OutgoingResponse, Buffer> {
  public serialize(value: OutgoingResponse): Buffer {
    const valueStr = JSON.stringify(value);
    return Buffer.from(valueStr);
  }
}

export class RabbitClientSerializer implements Serializer<ReadPacket, Buffer> {
  public serialize(value: ReadPacket<any>): Buffer {
    const { data } = value;
    if (isString(data)) {
      return Buffer.from(data);
    }
    const json = JSON.stringify(data);
    return Buffer.from(json);
  }
}
