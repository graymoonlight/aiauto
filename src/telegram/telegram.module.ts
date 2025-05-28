import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { DeepseekService } from '../deepseek/deepseek.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule],
  providers: [TelegramService, DeepseekService, PrismaService, AuthService, JwtService],
  controllers: [TelegramController],
})
export class TelegramModule {}
