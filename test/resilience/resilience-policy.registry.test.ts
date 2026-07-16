import { Test, TestingModule } from '@nestjs/testing';
import { BrokenCircuitError } from 'cockatiel';
import { LoggerModule } from 'nestjs-pino';

import { ResiliencePolicyRegistry } from '../../src/resilience/resilience-policy.registry';

describe('ResiliencePolicyRegistry Unit Test', () => {
  let sut: ResiliencePolicyRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot()],
      providers: [ResiliencePolicyRegistry],
    }).compile();

    sut = module.get(ResiliencePolicyRegistry);
    jest.clearAllMocks();
  });

  describe('Given getOrCreate, When called', () => {
    describe('And no policy exists for the given name', () => {
      test('Then it returns a policy with an execute method', () => {
        const policy = sut.getOrCreate('test.op');
        expect(typeof policy.execute).toBe('function');
      });
    });

    describe('And a policy already exists for the given name', () => {
      test('Then it returns the same policy instance', () => {
        const a = sut.getOrCreate('cached.op');
        const b = sut.getOrCreate('cached.op');
        expect(a).toBe(b);
      });
    });

    describe('And different names are passed', () => {
      test('Then it returns different policy instances', () => {
        const a = sut.getOrCreate('op.one');
        const b = sut.getOrCreate('op.two');
        expect(a).not.toBe(b);
      });
    });
  });

  describe('Given a created policy', () => {
    describe('When the operation succeeds on the first attempt', () => {
      test('Then it resolves with the operation result', async () => {
        const policy = sut.getOrCreate('success.op');
        const result = await policy.execute(() => Promise.resolve('ok'));
        expect(result).toBe('ok');
      });
    });

    describe('When the operation fails then recovers', () => {
      test('Then it retries until success', async () => {
        const policy = sut.getOrCreate('retry.op', { maxAttempts: 3, initialDelay: 0 });
        const op = jest
          .fn()
          .mockRejectedValueOnce(new Error('first'))
          .mockRejectedValueOnce(new Error('second'))
          .mockResolvedValueOnce('third');

        const result = await policy.execute(op);

        expect(result).toBe('third');
        expect(op).toHaveBeenCalledTimes(3);
      });
    });

    describe('When all attempts are exhausted', () => {
      test('Then it throws the last error', async () => {
        const policy = sut.getOrCreate('exhaust.op', { maxAttempts: 2, initialDelay: 0 });
        const op = jest.fn().mockRejectedValue(new Error('always fails'));

        await expect(policy.execute(op)).rejects.toThrow('always fails');
        expect(op).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Given circuit breaker state', () => {
    describe('When the failure threshold is breached', () => {
      test('Then it rejects with BrokenCircuitError and stops calling the operation', async () => {
        const policy = sut.getOrCreate('trip.op', {
          maxAttempts: 1,
          initialDelay: 0,
          threshold: 0.5,
          minimumRps: 1,
          durationMs: 500,
        });

        const op = jest.fn().mockRejectedValue(new Error('down'));

        for (let i = 0; i < 10; i++) {
          await policy.execute(op).catch(() => null);
        }

        const callsBeforeOpen = op.mock.calls.length;
        await expect(policy.execute(op)).rejects.toThrow(BrokenCircuitError);
        expect(op).toHaveBeenCalledTimes(callsBeforeOpen);
      });
    });

    describe('When the circuit is open and halfOpenAfter elapses', () => {
      test('Then it allows a probe call and closes on success', async () => {
        const policy = sut.getOrCreate('recover.op', {
          maxAttempts: 1,
          initialDelay: 0,
          threshold: 0.5,
          minimumRps: 1,
          durationMs: 500,
          halfOpenAfter: 1000,
        });

        const op = jest.fn().mockRejectedValue(new Error('down'));

        for (let i = 0; i < 10; i++) {
          await policy.execute(op).catch(() => null);
        }

        await expect(policy.execute(op)).rejects.toThrow(BrokenCircuitError);
        const callsWhileOpen = op.mock.calls.length;

        jest.useFakeTimers();
        jest.advanceTimersByTime(1100);

        op.mockResolvedValueOnce('recovered');
        const result = await policy.execute(op);
        expect(result).toBe('recovered');
        expect(op).toHaveBeenCalledTimes(callsWhileOpen + 1);

        op.mockResolvedValueOnce('normal');
        await expect(policy.execute(op)).resolves.toBe('normal');

        jest.useRealTimers();
      });
    });
  });
});
