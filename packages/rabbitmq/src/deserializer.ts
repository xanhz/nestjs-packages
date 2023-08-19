import { Deserializer, IncomingEvent, IncomingResponse } from '@nestjs/microservices';
import { ConsumeMessage } from 'amqplib';

export class RabbitServerDeserializer implements Deserializer<ConsumeMessage, IncomingEvent> {
  public deserialize(msg: ConsumeMessage): IncomingEvent | Promise<IncomingEvent> {
    const { content } = msg;
    const strContent = content.toString('utf8');
    let data: object | string;
    try {
      data = JSON.parse(strContent);
    } catch (error) {
      data = strContent;
    }
    return {
      pattern: null,
      data,
    };
  }
}

export class RabbitClientDeserializer implements Deserializer<ConsumeMessage, IncomingResponse> {
  public deserialize(msg: ConsumeMessage): IncomingResponse | Promise<IncomingResponse> {
    const { content } = msg;
    const strContent = content.toString('utf8');
    return JSON.parse(strContent);
  }
}
