import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeepseekService } from './deepseek.service';

@Module({
  imports: [ConfigModule],
  providers: [DeepseekService],
  exports: [DeepseekService]
})
export class DeepseekModule {}