import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import { ResiliencePolicyRegistry } from '../../src/resilience/resilience-policy.registry';
import { ResilienceService } from '../../src/resilience/resilience.service';

const mockPolicy = { execute: jest.fn() };
const mockRegistry = { getOrCreate: jest.fn().mockReturnValue(mockPolicy) };

describe('ResilienceService Unit Test', () => {
  let sut: ResilienceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot()],
      providers: [
        ResilienceService,
        { provide: ResiliencePolicyRegistry, useValue: mockRegistry },
      ],
    }).compile();

    sut = module.get(ResilienceService);
    jest.clearAllMocks();
    mockRegistry.getOrCreate.mockReturnValue(mockPolicy);
  });

  describe('Given execute, When called', () => {
    describe('And the operation succeeds', () => {
      test('Then it retrieves the policy by operation name and returns the result', async () => {
        mockPolicy.execute.mockResolvedValueOnce('result');

        const result = await sut.execute(() => Promise.resolve('result'), 'my.op');

        expect(mockRegistry.getOrCreate).toHaveBeenCalledWith('my.op', {});
        expect(result).toBe('result');
      });
    });

    describe('And options with input are passed', () => {
      test('Then it strips input before forwarding policy options to the registry', async () => {
        mockPolicy.execute.mockResolvedValueOnce('ok');

        await sut.execute(() => Promise.resolve('ok'), 'my.op', {
          maxAttempts: 5,
          input: { userId: 42 },
        });

        expect(mockRegistry.getOrCreate).toHaveBeenCalledWith('my.op', { maxAttempts: 5 });
      });
    });
  });
});
