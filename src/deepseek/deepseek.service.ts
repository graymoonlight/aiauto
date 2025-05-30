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
    return `Ты — профессиональный копирайтер, создающий продающие описания автомобилей для объявлений.

    Цель: превратить техническое описание автомобиля в яркий, эмоционально привлекательный текст, вызывающий желание купить. Сохраняй факты, но преподноси их живо и убедительно.

    ⚙️ Обязательная структура:
    1. 🔥 **Яркий заголовок** — модель, ключевые фишки, цена. Используй эмодзи и выразительные слова.
    2. ✨ **Вводный абзац** — уникальная история авто (один владелец, реальный пробег, гаражное хранение, причина продажи и т.д.)
    3. ✅ **Список преимуществ и опций** — кратко, по пунктам. Используй эмодзи и продающие слова.
    4. 📌 **Призыв к действию** — подчеркни выгоду, срочность или уникальность предложения.

    💡 Стиль:
    - Пиши кратко, чётко, привлекательно — не более **300 токенов**.
    - Используй **эмоции, эмодзи, глаголы действия**.
    - Избегай сухой перечислительности — текст должен вдохновлять и продавать.
    - Старайся, чтобы даже человек без автоопыта понял, почему эта машина — супервыбор.

    📘 Пример:
    Производство: июль 2020 года  
    🔥 Changan CS55 Plus 1.5T Автомат, версия Xuanse — всего за 1.230.000₽!  
    Автомобиль в отличном состоянии, один владелец, бережная эксплуатация, без ДТП.  
    Реальный пробег — 29 600 км. Полная история обслуживания.

    ✅ Комплектация и фишки:
    - Бесключевой доступ и запуск с кнопки  
    - Кожаный салон и многофункциональный руль  
    - ЖК-дисплей и камера заднего вида  
    - Электролюк, климат-контроль, круиз-контроль  
    - Светодиодные фары и подогрев сидений

    🚗 Забирай уже сегодня — машина полностью готова к эксплуатации! 🤗

    Пиши в таком стиле, даже если исходный текст скучный — ты должен превратить его в рекламную подачу, которая продаёт. Используй подходящие эмодзи`;
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
    return this.configService.get<number>('MAX_TOKENS', 600);
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
