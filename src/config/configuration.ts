import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-r1:free',
  maxTokens: parseInt(process.env.MAX_TOKENS || '600', 10),
  appUrl: process.env.APP_URL || 'http://localhost:7000',
  appTitle: process.env.APP_TITLE || 'Auto Bot Dev',
}));