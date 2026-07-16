import { Reflector } from '@nestjs/core';

import { TRACK_AI_USAGE_KEY, TrackAiUsage } from '../../src/metrics/track-ai-usage.decorator';

class Dummy {
  @TrackAiUsage('RAG_ASK')
  tagged() {
    return 'ok';
  }

  untagged() {
    return 'ok';
  }
}

describe('TrackAiUsage Unit Test', () => {
  const reflector = new Reflector();

  describe('Given a method decorated with @TrackAiUsage', () => {
    test('Then it stores the operation as retrievable metadata', () => {
      const meta = reflector.get(TRACK_AI_USAGE_KEY, Dummy.prototype.tagged);
      expect(meta).toEqual({ operation: 'RAG_ASK' });
    });
  });

  describe('Given a method without the decorator', () => {
    test('Then no metadata is present', () => {
      const meta = reflector.get(TRACK_AI_USAGE_KEY, Dummy.prototype.untagged);
      expect(meta).toBeUndefined();
    });
  });
});
