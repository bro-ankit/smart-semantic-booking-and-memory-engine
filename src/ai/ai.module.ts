import { Global, Module } from '@nestjs/common';

import { AI_CLIENT } from './ai.constants';
import { GeminiClient } from './gemini/gemini.client';
import { GeminiModule } from './gemini/gemini.module';

@Global()
@Module({
  imports: [GeminiModule],
  providers: [GeminiClient, { provide: AI_CLIENT, useExisting: GeminiClient }],
  exports: [AI_CLIENT],
})
export class AiModule {}
