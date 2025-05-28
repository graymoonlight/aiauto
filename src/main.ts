import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TelegramService } from './telegram/telegram.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const telegramService = app.get(TelegramService);
  telegramService.launch();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );
  await app.listen(process.env.PORT || 7000);
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
}
bootstrap();