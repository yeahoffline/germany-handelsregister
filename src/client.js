import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseSearchResults } from './parser.js';
import { parseAnnouncements } from './announcements-parser.js';

const SCHLAGWORT_OPTIONEN = { all: '1', min: '2', exact: '3' };
const ANNOUNCEMENTS_CACHE_DIR = join(tmpdir(), 'handelsregister_announcements_cache');

/**
 * Format Date as dd.MM.yyyy for the announcements form.
 */
function formatDateDE(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}
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
   * Search Registerbekanntmachungen (register announcements).
   * @param {Object} options
   * @param {Date|string} [options.dateFrom] - Start date (Date or dd.MM.yyyy string). Default: 7 days ago
   * @param {Date|string} [options.dateTo] - End date (Date or dd.MM.yyyy string). Default: today
   * @param {string} [options.bundesland=''] - Federal state code (BW, BY, BE, etc.) or '' for all
   * @param {string} [options.kategorie=''] - Category: 1-5 or '' for all
   * @param {boolean} [options.force=false] - Bypass cache
   * @returns {Promise<Array<Object>>}
   */
  async searchAnnouncements(options = {}) {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    let dateFrom = options.dateFrom ?? weekAgo;
    let dateTo = options.dateTo ?? today;
    const bundesland = options.bundesland ?? '';
    const kategorie = options.kategorie ?? '';
    const force = options.force ?? false;

    if (typeof dateFrom === 'string') dateFrom = new Date(dateFrom.split('.').reverse().join('-'));
    if (typeof dateTo === 'string') dateTo = new Date(dateTo.split('.').reverse().join('-'));
    const dateFromStr = formatDateDE(dateFrom);
    const dateToStr = formatDateDE(dateTo);

    const cacheKey = `ann_${dateFromStr}_${dateToStr}_${bundesland}_${kategorie}`.replace(/[/\\?*:|"<>]/g, '_');
    const cachePath = join(ANNOUNCEMENTS_CACHE_DIR, cacheKey);

    if (!force) {
      try {
        if (existsSync(cachePath)) {
          const html = await readFile(cachePath, 'utf-8');
          if (this.debug) console.error(`return cached announcements for ${dateFromStr} - ${dateToStr}`);
          return parseAnnouncements(html);
        }
      } catch (err) {
        if (this.debug) console.error('Cache read error:', err);
      }
    }

    if (!this.page) await this.openStartpage();

    // Navigate to Registerbekanntmachungen
    const currentUrl = this.page.url();
    if (!currentUrl.includes('bekanntmachungen')) {
      await this.page.evaluate(() => {
        const form = document.querySelector('form[name="naviForm"]');
        if (form) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'naviForm:bekanntmachungenLink';
          input.value = 'naviForm:bekanntmachungenLink';
          form.appendChild(input);
          const target = document.createElement('input');
          target.type = 'hidden';
          target.name = 'target';
          target.value = 'bekanntmachungenLink';
          form.appendChild(target);
          form.submit();
        }
      });
      await this.page.waitForLoadState('domcontentloaded');
      await new Promise((r) => setTimeout(r, 3000));
    }

    await this.page.waitForSelector('input[name="bekanntMachungenForm:datum_von_input"]', { timeout: 20000 });

    await this.page.fill('input[name="bekanntMachungenForm:datum_von_input"]', dateFromStr);
    await this.page.fill('input[name="bekanntMachungenForm:datum_bis_input"]', dateToStr);

    if (bundesland) {
      await this.page.selectOption('select[name="bekanntMachungenForm:land_input"]', bundesland);
    }
    if (kategorie) {
      await this.page.selectOption('select[name="bekanntMachungenForm:kategorie_input"]', kategorie);
    }

    await this.page.click('button[name="bekanntMachungenForm:rrbSuche"]');
    await this.page.waitForLoadState('domcontentloaded');
    await new Promise((r) => setTimeout(r, 2000));

    const html = await this.page.content();

    try {
      await mkdir(ANNOUNCEMENTS_CACHE_DIR, { recursive: true });
      await writeFile(cachePath, html, 'utf-8');
    } catch (err) {
      if (this.debug) console.error('Cache write error:', err);
    }

    return parseAnnouncements(html);
  }

  /**
   * Close the browser. Call when done to free resources.
   */
  async close() {
    if (this.browser) await this.browser.close();
  }
}
