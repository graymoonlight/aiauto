import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { Update, PhotoSize } from 'telegraf/typings/core/types/typegram';
import { AuthService } from 'src/auth/auth.service';
import { DeepseekService } from 'src/deepseek/deepseek.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface SessionData {
  photoPath: string;
  caption: string;
  generatedText: string;
}

// Добавляем тип для хранения статусов авторизации пользователей и состояний ввода
type UserAuthState = 'awaiting_login' | 'awaiting_password' | 'authenticated';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Telegraf<Context>;
  private uploadDir = path.join(__dirname, '..', '..', 'uploads');
  private userSessions = new Map<number, SessionData>();
  private mediaGroupBuffers = new Map<string, { userId: number, photos: PhotoSize[], caption: string, timer: NodeJS.Timeout }>();
  private mediaGroups = new Map<string, { userId: number; photos: PhotoSize[]; caption?: string }>();
  private mediaGroupTimers = new Map<string, NodeJS.Timeout>();

  // Хранит ID пользователей, которые прошли авторизацию
  private authenticatedUsers = new Set<number>();

  // Хранит временные состояния по пользователям для ввода логина/пароля
  private userAuthStates = new Map<number, { state: UserAuthState; login?: string }>();

  private readonly channelId = process.env.TELEGRAM_CHANNEL_ID as string;

  constructor(
    private deepseek: DeepseekService,
    private authService: AuthService
  ) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    this.bot = new Telegraf(token);
  }

  onModuleInit() {
    this.setupHandlers();
  }

  private setupHandlers() {
    // Команда /start запускает процесс авторизации
    this.bot.start(async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      // Сбрасываем сессию и авторизацию для нового /start
      this.userSessions.delete(userId);
      this.authenticatedUsers.delete(userId);
      this.userAuthStates.set(userId, { state: 'awaiting_login' });

      await ctx.reply('👋 Добро пожаловать! Пожалуйста, введите ваш логин:');
    });

    // Обработка любых сообщений
    this.bot.on('message', async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      // Получаем текущее состояние авторизации пользователя
      const authState = this.userAuthStates.get(userId);

      // Если пользователь не авторизован
      if (!this.authenticatedUsers.has(userId)) {
        if (!authState) {
          // Если состояния нет, значит нужно начать с логина
          this.userAuthStates.set(userId, { state: 'awaiting_login' });
          await ctx.reply('❗ Пожалуйста, введите ваш логин:');
          return;
        }

      if (authState.state === 'awaiting_login') {
        // Запоминаем логин, просим пароль
        if (!ctx.message || !('text' in ctx.message)) {
          await ctx.reply('Пожалуйста, введите текстом ваш логин.');
          return;
        }
        this.userAuthStates.set(userId, { state: 'awaiting_password', login: ctx.message.text });
        await ctx.reply('Введите пароль:');
        return;
      }

      if (authState.state === 'awaiting_password') {
        if (!ctx.message || !('text' in ctx.message)) {
          await ctx.reply('Пожалуйста, введите текстом ваш пароль.');
          return;
        }

        const login = authState.login!;
        const password = ctx.message.text;

        // Вызов новой асинхронной проверки
        const isValid = await this.validateCredentials(login, password);

        if (isValid) {
          this.authenticatedUsers.add(userId);
          this.userAuthStates.delete(userId); // очистим состояние
          await ctx.reply('✅ Авторизация успешна! Отправьте описание автомобиля и прикрепите фото 🚗📸');
        } else {
          // При неудаче — заново запрос логина
          this.userAuthStates.set(userId, { state: 'awaiting_login' });
          await ctx.reply('❌ Неверный логин или пароль. Попробуйте снова.\nВведите логин:');
        }
        return;
      }

      // Если состояние какое-то неизвестное — попросим пройти авторизацию заново
      await ctx.reply('❗ Пожалуйста, завершите авторизацию. Введите ваш логин:');
      this.userAuthStates.set(userId, { state: 'awaiting_login' });
      return;
    }

    // Если авторизован — передаем дальше в цепочку обработчиков
    await next();
  });

    // Обработка команды для старта работы (можно оставить, если нужно)
    this.bot.action('start', async (ctx) => {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      if (!userId) return;

      if (!this.authenticatedUsers.has(userId)) {
        await ctx.reply('❗ Пожалуйста, сначала авторизуйтесь командой /start.');
        return;
      }

      await ctx.reply('Отправьте описание автомобиля и прикрепите фото 🚗📸');
    });

    // Обработка фото — только если авторизован
    this.bot.on('photo', async (ctx) => {
      const userId = ctx.from?.id;
        if (!userId) return;
        if (!this.authenticatedUsers.has(userId)) {
          await ctx.reply('❗ Пожалуйста, авторизуйтесь, прежде чем отправлять фото.');
          return;
        }

        const message = ctx.message;
        const mediaGroupId = message.media_group_id;
        const caption = message.caption || '';

  if (mediaGroupId) {
    // Если альбом
    const existing = this.mediaGroupBuffers.get(mediaGroupId);
    if (existing) {
      existing.photos.push(...message.photo);
    } else {
      const timer = setTimeout(async () => {
        const buffer = this.mediaGroupBuffers.get(mediaGroupId);
        if (!buffer) return;

        const bestPhoto = buffer.photos.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];
        const savedPath = await this.saveBestPhoto(ctx, [bestPhoto]);
        const generatedText = await this.deepseek.generateText(buffer.caption);

        this.userSessions.set(userId, {
          photoPath: savedPath,
          caption: buffer.caption,
          generatedText,
        });

        await ctx.replyWithPhoto(
          { source: fs.createReadStream(savedPath) },
          {
            caption: generatedText,
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [{ text: '✅ Опубликовать', callback_data: 'publish' }],
              [{ text: '🔄 Перегенерировать', callback_data: 'regenerate' }],
            ]),
          }
        );

        this.mediaGroupBuffers.delete(mediaGroupId);
      }, 700); // задержка ожидания всех фото

      this.mediaGroupBuffers.set(mediaGroupId, {
        userId,
        caption,
        photos: [...message.photo],
        timer,
      });
    }

    return;
  }

  // Одиночное фото
  try {
    const savedPath = await this.saveBestPhoto(ctx, message.photo);
    const generatedText = await this.deepseek.generateText(caption);

    this.userSessions.set(userId, {
      photoPath: savedPath,
      caption,
      generatedText,
    });

    await ctx.replyWithPhoto(
      { source: fs.createReadStream(savedPath) },
      {
        caption: generatedText,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [{ text: '✅ Опубликовать', callback_data: 'publish' }],
          [{ text: '🔄 Перегенерировать', callback_data: 'regenerate' }],
        ]),
      }
    );
  } catch (error) {
    await ctx.reply('Произошла ошибка: ' + error.message);
  }
});


    // Обработка callback query — тоже только для авторизованных
    this.bot.on('callback_query', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      if (!this.authenticatedUsers.has(userId)) {
        return ctx.answerCbQuery('❗ Пожалуйста, авторизуйтесь.');
      }

      const session = this.userSessions.get(userId);

      if (!session) {
        return ctx.answerCbQuery('Нет данных для публикации.');
      }

      if ('data' in ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;

        if (data === 'publish') {
          await ctx.answerCbQuery('Публикуем...');

          await ctx.telegram.sendPhoto(this.channelId, {
            source: fs.createReadStream(session.photoPath),
          }, {
            caption: session.generatedText,
            parse_mode: 'Markdown',
          });

          await ctx.reply('✅ Опубликовано в канале. Ниже можете прикрепить фото и написать текст снова!)');

          fs.unlinkSync(session.photoPath);
          this.userSessions.delete(userId);

        } else if (data === 'regenerate') {
          await ctx.answerCbQuery('Перегенерация...');
          const newText = await this.deepseek.generateText(session.caption);
          session.generatedText = newText;

          await ctx.replyWithPhoto(
            { source: fs.createReadStream(session.photoPath) },
            {
              caption: newText,
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [{ text: '✅ Опубликовать', callback_data: 'publish' }],
                [{ text: '🔄 Перегенерировать', callback_data: 'regenerate' }],
              ]),
            }
          );
        }
      } else {
        await ctx.answerCbQuery('Неверный тип callback.');
      }
    });
  }

  // Пример проверки логина/пароля — заменить на вашу логику
  private async validateCredentials(login: string, password: string): Promise<boolean> {
    try {
      await this.authService.validateUser({ username: login, password });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async saveBestPhoto(ctx: Context, photos: PhotoSize[]): Promise<string> {
    const bestPhoto = photos[photos.length - 1];
    const fileId = bestPhoto.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const fileName = `${fileId}.jpg`;
    const filePath = path.join(this.uploadDir, fileName);

    const response = await axios.get(fileLink.href, { responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return filePath;
  }

  handleUpdate(update: Update) {
    return this.bot.handleUpdate(update);
  }

  async launch() {
    await this.bot.launch();
  }
}
