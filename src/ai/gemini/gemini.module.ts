import { GoogleGenerativeAI } from '@google/generative-ai';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ENV_VARIABLES } from '../../constants/env.constants';
import { GEMINI_CLIENT } from './gemini.constants';

const GEMINI_PROVIDER = {
  provide: GEMINI_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): GoogleGenerativeAI => {
    const apiKey = config.getOrThrow<string>(ENV_VARIABLES.GEMINI.API_KEY);
    return new GoogleGenerativeAI(apiKey);
  },
};

@Global()
@Module({
  providers: [GEMINI_PROVIDER],
  exports: [GEMINI_CLIENT],
})
export class GeminiModule {}
