import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseSearchResults } from './parser.js';

const SCHLAGWORT_OPTIONEN = { all: '1', min: '2', exact: '3' };
const BASE_URL = 'https://www.handelsregister.de';
const CACHE_DIR = join(tmpdir(), 'handelsregister_cache');

/**
 * Create a filesystem-safe cache key from search options.
 * @param {string} schlagwoerter
 * @param {string} schlagwortOptionen
 * @returns {string}
 */
function getCacheKey(schlagwoerter, schlagwortOptionen) {
  const safe = `${schlagwoerter}_${schlagwortOptionen}`
    .replace(/[/\\?*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);
  return safe || 'default';
}

export class HandelsregisterClient {
  /**
   * @param {Object} options
   * @param {boolean} [options.debug=false]
   */
  constructor(options = {}) {
    this.debug = options.debug ?? false;
  }

  /**
   * Open the start page (called before search).
   * @returns {Promise<void>}
   */
  async openStartpage() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15',
      locale: 'de-DE',
    });
    this.page = await this.context.newPage();
    await this.page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
    await this.acceptCookiesIfPresent();
  }

  async acceptCookiesIfPresent() {
    try {
      const acceptBtn = this.page.locator(
        'a:has-text("Verstanden"), a:has-text("Okay"), button:has-text("Verstanden"), button:has-text("Okay")'
      ).first();
      if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch {
      // Cookie banner may not be present
    }
  }

  /**
   * Search for companies.
   * @param {Object} options
   * @param {string} options.schlagwoerter - Search keywords
   * @param {string} [options.schlagwortOptionen='all'] - all | min | exact
   * @param {boolean} [options.force=false] - Bypass cache and fetch fresh
   * @returns {Promise<Array<Object>>}
   */
  async search(options) {
    const { schlagwoerter, schlagwortOptionen = 'all', force = false } = options;
    const soId = SCHLAGWORT_OPTIONEN[schlagwortOptionen] ?? '1';
    const cacheKey = getCacheKey(schlagwoerter, schlagwortOptionen);
    const cachePath = join(CACHE_DIR, cacheKey);

    if (!force) {
      try {
        if (existsSync(cachePath)) {
          const html = await readFile(cachePath, 'utf-8');
          if (this.debug) {
            console.error(`return cached content for ${schlagwoerter}`);
          }
          return parseSearchResults(html);
        }
      } catch (err) {
        if (this.debug) console.error('Cache read error:', err);
      }
    }

    if (!this.page) await this.openStartpage();

    // Submit naviForm to reach extended search (same flow as Python/mechanize)
    const currentUrl = this.page.url();
    if (!currentUrl.includes('erweitertesuche')) {
      await this.page.evaluate(() => {
        const form = document.querySelector('form[name="naviForm"]');
        if (form) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'naviForm:erweiterteSucheLink';
          input.value = 'naviForm:erweiterteSucheLink';
          form.appendChild(input);
          const target = document.createElement('input');
          target.type = 'hidden';
          target.name = 'target';
          target.value = 'erweiterteSucheLink';
          form.appendChild(target);
          form.submit();
        }
      });
      await this.page.waitForLoadState('domcontentloaded');
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Wait for search form - schlagwoerter is a textarea, schlagwortOptionen are radio buttons
    const searchInput = this.page.locator(
      'textarea[name="form:schlagwoerter"], input[name="form:schlagwoerter"], [name*="schlagwoerter"]'
    ).first();
    await searchInput.waitFor({ state: 'attached', timeout: 25000 });

    if (this.debug) {
      console.error('Page title:', await this.page.title());
    }

    // Fill search form - textarea for keywords
    await searchInput.fill(schlagwoerter);
    // schlagwortOptionen: radio buttons with value 1/2/3 (all/min/exact) - may be off-screen
    await this.page.locator(`input[name="form:schlagwortOptionen"][value="${soId}"]`).check({ force: true });
    const submitBtn = this.page.locator('button[name="form:btnSuche"], button:has-text("Suchen")').first();
    await submitBtn.click();
    await this.page.waitForLoadState('domcontentloaded');

    if (this.debug) {
      console.error('Page title:', await this.page.title());
    }

    const html = await this.page.content();

    // Write to cache
    try {
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(cachePath, html, 'utf-8');
    } catch (err) {
      if (this.debug) console.error('Cache write error:', err);
    }

    return parseSearchResults(html);
  }

  /**
   * Close the browser. Call when done to free resources.
   */
  async close() {
    if (this.browser) await this.browser.close();
  }
}
