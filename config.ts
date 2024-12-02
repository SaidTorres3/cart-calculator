import { OPENAI_API_KEY as ENV_OPENAI_API_KEY } from '@env';

if (!ENV_OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined in .env file');
}

export const OPENAI_API_KEY = ENV_OPENAI_API_KEY;
