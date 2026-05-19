import { Global, Module } from '@nestjs/common';
import { GeminiModule } from './gemini/gemini.module';
import { GeminiClient } from './gemini/gemini.client';
import { AI_CLIENT } from './ai.constants';

@Global()
@Module({
  imports: [GeminiModule],
  providers: [
    GeminiClient,
    { provide: AI_CLIENT, useExisting: GeminiClient },
  ],
  exports: [AI_CLIENT],
})
export class AiModule { }
