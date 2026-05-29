# ADR-014: Tiered Scraping Strategy — Cheerio/Readability First, Puppeteer Fallback

**Status:** Accepted  
**Date:** 2026-05-29

## Context

URL content extraction requires fetching and parsing HTML. Two approaches exist:

| Approach | Startup cost | Works on SPAs | Cost |
|----------|-------------|---------------|------|
| `fetch` + HTML parser | ~5–50ms | No | Free |
| Puppeteer (headless Chrome) | ~2–5s | Yes | ~250MB RAM per instance |

The naïve production choice is Puppeteer for everything — it handles all pages. The cost is unacceptable: every scrape spins up a full Chrome process, burning ~5 seconds and ~250MB of RAM. Under any load this creates memory pressure and slows throughput significantly.

Cheerio alone was also considered and rejected: it cannot execute JavaScript, so SPAs (React, Vue, Angular apps without SSR) return near-empty HTML shells.

## Decision

Implement a two-tier strategy in `ScraperService.scrape()`:

```
attempt fetch + @mozilla/readability
         │
    content ≥ 200 chars?
    ├─ Yes ──► return content (Puppeteer never runs)
    └─ No  ──► fall back to Puppeteer
```

### Tier 1 — `fetch` + `@mozilla/readability`

Native `fetch` with a `BookmarkBot` user-agent header. On a 200 response, the body is parsed with `@mozilla/readability` (Firefox's Reader Mode algorithm), which strips navigation, ads, footers, and sidebars — leaving only the article content. This handles all server-side-rendered pages: documentation sites, GitHub files, blog posts, technical articles.

`@mozilla/readability` is preferred over Cheerio because:
- It extracts semantic article content, not raw DOM text
- It handles common page layouts (article, section, main) intelligently
- It produces consistent output without per-site CSS selectors

If Readability cannot parse the page (e.g. non-article structure), the fallback is `body.textContent` stripped of excess whitespace.

A non-2xx status or network error returns `null` immediately, triggering Tier 2 without counting as a content failure.

### Tier 2 — Puppeteer (`networkidle2` + Readability)

Puppeteer launches with `--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu` for Docker compatibility. It waits for `networkidle2` (no more than 2 active network connections for 500ms) to ensure JavaScript has rendered the page. The same Readability + `body.textContent` fallback logic is then applied.

The browser is always closed in a `finally` block — no zombie Chrome processes.

### Content threshold

`MIN_CONTENT_LENGTH = 200` characters. This was chosen to distinguish meaningful article content from common "thin" pages: login walls, 403 pages, navigation-only shells, and React app root divs (typically `<div id="root"></div>`).

## Consequences

- Static pages (GitHub files, MDN, blog posts, Stack Overflow) never start Puppeteer — they complete in under 100ms
- JavaScript-rendered SPAs get a full Chrome render only when genuinely needed
- Memory and CPU usage scales with actual need, not worst-case assumptions
- Both tiers produce the same output shape (`string`) — `ScrapingProcessor` is unaware of which tier ran
- Adding a third tier (e.g. Playwright) requires only modifying `ScraperService` — the processor and ingest pipeline are unaffected
