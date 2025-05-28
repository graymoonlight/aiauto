import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);

  constructor(private configService: ConfigService) {}

  async generateText(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        this.getApiUrl(),
        {
          model: this.getModel(),
          messages: [
            { role: 'system', content: this.createSystemMessage() },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: this.getMaxTokens(),
        },
        {
          headers: this.getHeaders(),
        },
      );

      this.logger.debug('API response: ' + JSON.stringify(response.data));

      // Проверяем структуру ответа и возвращаем контент
      if (
        response.data &&
        Array.isArray(response.data.choices) &&
        response.data.choices.length > 0 &&
        response.data.choices[0].message &&
        typeof response.data.choices[0].message.content === 'string'
      ) {
        return response.data.choices[0].message.content;
      } else {
        this.logger.error('Unexpected API response format', response.data);
        return 'Ошибка: некорректный ответ от API';
      }
    } catch (error: any) {
      this.handleError(error);
      return 'Ошибка генерации текста';
    }
  }

  private createSystemMessage(): string {
    return `Ты — профкопирайтер. Преобразуй этот текст автомобиля в продающее описание:
- Заголовок, преимущества, детали
- Маркированные списки
- Эмодзи для акцентов
- Кратко и привлекательно, не выходи за рамки 300 токенов`;
  }

  private getApiUrl(): string {
    return this.configService.get<string>(
      'OPENROUTER_API_URL',
      'https://openrouter.ai/v1/chat/completions',
    );
  }

  private getModel(): string {
    return this.configService.get<string>('DEEPSEEK_MODEL', 'deepseek/deepseek-r1:free');
  }

  private getMaxTokens(): number {
    return this.configService.get<number>('MAX_TOKENS', 300);
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.configService.get<string>('OPENROUTER_API_KEY')}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.configService.get<string>('APP_URL', 'http://localhost:7000'),
      'X-Title': this.configService.get<string>('APP_TITLE', 'Car AI'),
    };
  }

  private handleError(error: any): void {
    if (error.response) {
      this.logger.error(`API Error [${error.response.status}]: ${JSON.stringify(error.response.data)}`);
      if (error.response.status === 429) {
        this.logger.error('Слишком много запросов! Попробуйте позже.');
      }
    } else {
      this.logger.error('Network Error:', error.message);
    }
  }
}
