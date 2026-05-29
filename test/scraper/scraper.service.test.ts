import { TestBed } from '@automock/jest';
import puppeteer from 'puppeteer';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { ScraperService } from '../../src/scraper/scraper.service';

const mockLaunch = (puppeteer as jest.Mocked<typeof puppeteer>).launch;
const MockReadability = Readability as jest.MockedClass<typeof Readability>;
const MockJSDOM = JSDOM as jest.MockedClass<typeof JSDOM>;

const SUBSTANTIAL_TEXT = 'Kafka partitioning distributes data across brokers. '.repeat(6);
const URL = 'https://example.com/kafka-partitioning';

function setupReadability(textContent: string) {
  MockJSDOM.mockImplementation(() => ({ window: { document: {} } } as any));
  MockReadability.mockImplementation(() => ({ parse: () => ({ textContent }) } as any));
}

function mockFetchResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue('<html><body></body></html>'),
  } as unknown as Response;
}

function setupPuppeteerBrowser(closeFn = jest.fn().mockResolvedValue(undefined)) {
  const page = {
    setUserAgent: jest.fn().mockResolvedValue(undefined),
    setViewport: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(undefined),
    content: jest.fn().mockResolvedValue('<html></html>'),
  };
  const browser = { newPage: jest.fn().mockResolvedValue(page), close: closeFn };
  mockLaunch.mockResolvedValue(browser as any);
  return { browser, page };
}

describe('ScraperService Unit Test', () => {
  let sut: ScraperService;

  beforeAll(() => {
    const { unit } = TestBed.create(ScraperService).compile();
    sut = unit;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('Given scrape, When called', () => {
    describe('And fetch returns substantial content', () => {
      test('Then it returns the Readability-extracted text without launching Puppeteer', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse());
        setupReadability(SUBSTANTIAL_TEXT);

        const result = await sut.scrape(URL);

        expect(result).toBe(SUBSTANTIAL_TEXT.trim());
        expect(mockLaunch).not.toHaveBeenCalled();

        expect(global.fetch).toHaveBeenCalledWith(
          URL,
          expect.objectContaining({
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkBot/1.0; +https://github.com/bro-ankit)' },
          }),
        );
      });

    });

    describe('And fetch returns thin content (JS-rendered stub)', () => {
      test('Then it falls back to Puppeteer', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(mockFetchResponse());
        MockJSDOM.mockImplementation(() => ({ window: { document: {} } } as any));
        MockReadability
          .mockImplementationOnce(() => ({ parse: () => ({ textContent: 'too short' }) } as any))
          .mockImplementationOnce(() => ({ parse: () => ({ textContent: SUBSTANTIAL_TEXT }) } as any));
        setupPuppeteerBrowser();

        const result = await sut.scrape(URL);
        expect(mockLaunch).toHaveBeenCalledTimes(1);
        expect(result).toBe(SUBSTANTIAL_TEXT.trim());
      });
    });
  })
});
