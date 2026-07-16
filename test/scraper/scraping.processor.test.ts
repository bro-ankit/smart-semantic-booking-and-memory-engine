import { TestBed } from '@automock/jest';
import type { Job } from 'bullmq';

import { IngestService } from '../../src/ingest/ingest.service';
import type { ScrapingJobData } from '../../src/scraper/scraper.constants';
import { ScraperService } from '../../src/scraper/scraper.service';
import { ScrapingProcessor } from '../../src/scraper/scraping.processor';
import { mockBookmarkSelect } from '../__mocks__/bookmark.mock';

function mockJob(data: ScrapingJobData, attemptsMade = 0): Job<ScrapingJobData> {
  return { data, attemptsMade } as Job<ScrapingJobData>;
}

describe('ScrapingProcessor Unit Test', () => {
  let sut: ScrapingProcessor;
  let scraperService: jest.Mocked<ScraperService>;
  let ingestService: jest.Mocked<IngestService>;

  const BOOKMARK_ID = 'bookmark-uuid-001';
  const URL = 'https://example.com/kafka-partitioning';
  const SCRAPED_TEXT = 'Kafka partitioning distributes data across brokers for horizontal scale.';

  const JOB = mockJob({ bookmarkId: BOOKMARK_ID, url: URL });
  const COMPLETED_BOOKMARK = mockBookmarkSelect({ id: BOOKMARK_ID, status: 'COMPLETED' });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ScrapingProcessor).compile();
    sut = unit;
    scraperService = unitRef.get(ScraperService);
    ingestService = unitRef.get(IngestService);
    scraperService.scrape.mockResolvedValue(SCRAPED_TEXT);
    ingestService.processRawText.mockResolvedValue(COMPLETED_BOOKMARK);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given process, When called with a scraping job', () => {
    test('Then it scrapes the URL from the job data and processes raw text', async () => {
      await sut.process(JOB);

      expect(scraperService.scrape).toHaveBeenCalledWith(URL);
      expect(ingestService.processRawText).toHaveBeenCalledWith(BOOKMARK_ID, SCRAPED_TEXT);

      const scrapeOrder = scraperService.scrape.mock.invocationCallOrder[0]!;
      const processOrder = ingestService.processRawText.mock.invocationCallOrder[0]!;

      expect(processOrder).toBeGreaterThan(scrapeOrder);
    });
  });
});
