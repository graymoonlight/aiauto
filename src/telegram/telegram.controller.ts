import { Controller, Post, Body } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { Update } from 'telegraf/typings/core/types/typegram';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  async handleUpdate(@Body() update: Update) {
    await this.telegramService.handleUpdate(update);
    return { ok: true };
  }
}