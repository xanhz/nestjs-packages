import { BaseRpcContext } from '@nestjs/microservices';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';

type Payload = any;
type RabbitContextArgs = [ConfirmChannel, Payload, ConsumeMessage];

export class RabbitContext extends BaseRpcContext<RabbitContextArgs> {
  constructor(args: RabbitContextArgs) {
    super(args);
  }

  getChannel() {
    return this.args[0];
  }

  getPayload(): Payload {
    return this.args[1];
  }

  getRawMessage(): ConsumeMessage {
    return this.args[2];
  }
}
