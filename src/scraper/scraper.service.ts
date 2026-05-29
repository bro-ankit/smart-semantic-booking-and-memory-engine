import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import puppeteer from 'puppeteer';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

const MIN_CONTENT_LENGTH = 200;

const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

const BOT_USER_AGENT = 'Mozilla/5.0 (compatible; BookmarkBot/1.0; +https://github.com/bro-ankit)';

@Injectable()
export class ScraperService {
  constructor(
    @InjectPinoLogger(ScraperService.name) private readonly logger: PinoLogger,
  ) { }

  async scrape(url: string): Promise<string> {
    const lightweight = await this.scrapeWithFetch(url);

    if (lightweight !== null) {
      this.logger.info({ url, chars: lightweight.length, strategy: 'fetch' }, 'Scrape complete');
      return lightweight;
    }

    this.logger.info({ url }, 'Fetch yielded thin content — falling back to Puppeteer');
    return this.scrapeWithPuppeteer(url);
  }

  private async scrapeWithFetch(url: string): Promise<string | null> {
    const response = await fetch(url, {
      headers: { 'User-Agent': BOT_USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      this.logger.warn({ url, status: response.status }, 'Fetch returned non-OK status');
      return null;
    }

    const html = await response.text();
    const text = this.extractReadableText(html, url);

    if (text.length < MIN_CONTENT_LENGTH) {
      return null;
    }

    return text;
  }

  private async scrapeWithPuppeteer(url: string): Promise<string> {
    const browser = await puppeteer.launch({ headless: true, args: PUPPETEER_ARGS });

    try {
      const page = await browser.newPage();
      await page.setUserAgent({ userAgent: BOT_USER_AGENT });
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

      const html = await page.content();
      const text = this.extractReadableText(html, url);

      this.logger.info({ url, chars: text.length, strategy: 'puppeteer' }, 'Scrape complete');
      return text;
    } finally {
      await browser.close();
    }
  }

  private extractReadableText(html: string, url: string): string {
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();

    if (article?.textContent && article.textContent.trim().length > MIN_CONTENT_LENGTH) {
      return article.textContent.trim();
    }

    const bodyText = dom.window.document.body?.textContent ?? '';
    return bodyText.replace(/\s+/g, ' ').trim();
  }
}
