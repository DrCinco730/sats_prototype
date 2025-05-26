// prototype-server/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        forbidUnknownValues: false,
      }),
  );

  app.enableCors({
    origin: ['http://localhost:3000'], // Allowed origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allowed methods
    credentials: true, // Allow credentials (e.g., cookies)
    allowedHeaders: 'Content-Type, Accept', // Allowed headers
  });

  // استخدام WsAdapter للتعامل مع WebSockets الخام
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();