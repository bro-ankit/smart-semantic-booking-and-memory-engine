import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { GoldenCase } from '../evals.types';

@Injectable()
export class EvalGoldenSetService {
  constructor(@InjectPinoLogger(EvalGoldenSetService.name) private readonly logger: PinoLogger) {}

  load(): GoldenCase[] {
    const filePath = join(process.cwd(), 'evals', 'golden-set.json');
    this.logger.debug({ filePath }, 'Loading golden eval set');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as GoldenCase[];
  }
}
