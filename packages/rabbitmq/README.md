# @xanhz/nestjs-rabbit

RabbitMQ ClientProxy & Server for NestJS Microservice

# **1. Installation**

```bash
# For npm
npm install @xanhz/nestjs-rabbit

# For yarn
yarn install @xanhz/nestjs-rabbit
```

# **2. Usage**

## **2.1. Server**

### Hybrid app

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { RabbitServer } from '@xanhz/nestjs-rabbit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    strategy: new RabbitServer({
      url: 'amqp://guest:guest@localhost:5672',
      exchanges: [
        {
          name: 'exchange-1',
          type: 'direct',
        },
      ],
      channels: [
        {
          name: 'channel-1',
          prefetchCount: 0, // Infinity
        },
        {
          name: 'channel-2',
          prefetchCount: 1,
        },
      ],
      manualAck: true,
    }),
  });
  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
```

### Single app

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { RabbitServer } from '@xanhz/nestjs-rabbit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    strategy: new RabbitServer({
      url: 'amqp://guest:guest@localhost:5672',
      exchanges: [
        {
          name: 'exchange-1',
          type: 'direct',
        },
      ],
      channels: [
        {
          name: 'channel-1',
          prefetchCount: 0, // Infinity
        },
        {
          name: 'channel-2',
          prefetchCount: 1,
        },
      ],
      manualAck: true,
    }),
  });
  await app.listen();
}
bootstrap();
```

### Subscribe Message

```ts
// app.controller.ts
import { Body, Controller, Inject, Logger, Post } from '@nestjs/common';
import { Ctx, Payload } from '@nestjs/microservices';
import { PublishOptions, RabbitClient, RabbitContext, RabbitRPC, RabbitSubscribe } from '@xanhz/nestjs-rabbit';

@Controller()
export class AppController {
  @RabbitSubscribe({
    channel: 'channel-1',
    queue: 'subscribe-queue',
  })
  public testSubscribe(@Payload() payload: any, @Ctx() ctx: RabbitContext) {
    const channel = ctx.getChannel();
    const rawMessage = ctx.getRawMessage();
    // do something here
  }

  @RabbitRPC({
    channel: 'channel-2',
    queue: 'rpc-queue',
    exchange: 'exchange-2',
    routingKey: 'rpc-route',
  })
  public testReply(@Payload() payload: any, @Ctx() ctx: RabbitContext) {
    const channel = ctx.getChannel();
    const rawMessage = ctx.getRawMessage();
    // return response here
  }
}
```

## **2.2. Client**

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { RabbitClient, RabbitClientOptions } from '@xanhz/nestjs-rabbit';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ClientsModule.registerAsync({
      isGlobal: true,
      clients: [
        {
          name: 'RABBIT',
          useFactory: () => {
            const options: RabbitClientOptions = {
              url: 'amqp://guest:guest@localhost:5672',
              exchanges: [
                {
                  name: 'exchange-1',
                  type: 'direct',
                },
              ],
            };
            return {
              customClass: RabbitClient,
              options,
            };
          },
        },
      ],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

```ts
// app.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { PublishOptions, RabbitClient } from '@xanhz/nestjs-rabbit';

@Injectable()
export class AppService {
  constructor(@Inject('RABBIT') private readonly rabbitClient: RabbitClient) {}

  public publish(data: any) {
    const publishOptions: PublishOptions = {
      queue: 'queue-1',
    };
    return this.rabbitClient.emit(publishOptions, data);
  }

  public rpc(data: any) {
    const publishOptions: PublishOptions = {
      queue: 'rpc-queue',
      exchange: 'exchange-2',
      routingKey: 'rpc-route',
    };
    return this.rabbitClient.send(publishOptions, data).subscribe({
      error: (err) => {
        // handle error here
      },
      next: (value) => {
        // handle response here
      },
    });
  }
}
```
