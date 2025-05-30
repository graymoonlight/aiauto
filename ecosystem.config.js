module.exports = {
  apps: [
    {
      name: 'autoai-bot',
      script: 'dist/src/main.js',          // Точка входа бота, после сборки в dist
      cwd: './',                       // Рабочая директория
      instances: 1,                    // Количество инстансов
      autorestart: true,               // Автоматический рестарт при сбоях
      watch: false,                    // Включить при локальной разработке
      max_memory_restart: '300M',      // Перезапуск при превышении памяти
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        OPENROUTER_API_URL: process.env.OPENROUTER_API_URL,
        DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
        MAX_TOKENS: process.env.MAX_TOKENS,
        APP_URL: process.env.APP_URL,
        APP_TITLE: process.env.APP_TITLE,
        BOT_PORT: process.env.BOT_PORT,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        FIRST_RUN_KEY: process.env.FIRST_RUN_KEY,
        LOG_LEVEL: process.env.LOG_LEVEL,
      },
    },
  ],
};