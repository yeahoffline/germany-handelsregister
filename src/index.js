#!/usr/bin/env node

import { program } from 'commander';
import { HandelsregisterClient } from './client.js';
import { parseSearchResults } from './parser.js';
import { parseAnnouncements } from './announcements-parser.js';

/**
 * Print company info in human-readable format.
 * @param {Object} c - Company result object
 */
function printCompanyInfo(c) {
  const tags = ['name', 'court', 'register_num', 'district', 'state', 'statusCurrent'];
  for (const tag of tags) {
    console.log(`${tag}: ${c[tag] ?? '-'}`);
  }
  console.log('history:');
  for (const [name, loc] of c.history ?? []) {
    console.log(name, loc);
  }
}

program
  .name('handelsregister')
  .description('CLI for the German Handelsregister (commercial register) portal');

program
  .command('search')
  .description('Search for companies by keywords')
  .requiredOption('-s, --schlagwoerter <keywords>', 'Search for the provided keywords')
  .option(
    '-o, --schlagwort-optionen <option>',
    'Keyword options: all=contain all keywords; min=contain at least one keyword; exact=contain the exact company name',
    'all'
  )
  .option('-f, --force', 'Force a fresh pull and skip the cache')
  .option('--json', 'Return response as JSON')
  .option('-d, --debug', 'Enable debug mode and activate logging')
  .action(async (options) => {
    const client = new HandelsregisterClient({ debug: options.debug });
    try {
      await client.openStartpage();
      const companies = await client.search({
        schlagwoerter: options.schlagwoerter,
        schlagwortOptionen: options.schlagwortOptionen,
        force: options.force,
      });
      if (companies != null && companies.length > 0) {
        if (options.json) {
          console.log(JSON.stringify(companies));
        } else {
          for (const c of companies) {
            printCompanyInfo(c);
          }
        }
      }
    } finally {
      await client.close();
    }
  });

program
  .command('announcements')
  .description('Search Registerbekanntmachungen (register announcements) - newly published register changes')
  .option('--from <date>', 'Start date (dd.MM.yyyy). Default: 7 days ago')
  .option('--to <date>', 'End date (dd.MM.yyyy). Default: today')
  .option('--bundesland <code>', 'Federal state: BW, BY, BE, BR, HB, HH, HE, MV, NI, NW, RP, SL, SN, ST, SH, TH. Default: all')
  .option('--kategorie <id>', 'Category: 1=Löschungsankündigung, 2=Umwandlungsgesetz, 3=Einreichung neuer Dokumente, 4=Sonstige, 5=Sonderregister')
  .option('-f, --force', 'Force a fresh pull and skip the cache')
  .option('--json', 'Return response as JSON')
  .option('-d, --debug', 'Enable debug mode')
  .action(async (options) => {
    const client = new HandelsregisterClient({ debug: options.debug });
    try {
      await client.openStartpage();
      const announcements = await client.searchAnnouncements({
        dateFrom: options.from,
        dateTo: options.to,
        bundesland: options.bundesland ?? '',
        kategorie: options.kategorie ?? '',
        force: options.force,
      });
      if (announcements != null && announcements.length > 0) {
        if (options.json) {
          console.log(JSON.stringify(announcements));
        } else {
          for (const a of announcements) {
            console.log(`${a.date} | ${a.category}`);
            console.log(`  ${a.court}`);
            console.log(`  ${a.name} – ${a.location}`);
            console.log();
          }
        }
      } else {
        console.log('No announcements found for the given criteria.');
      }
    } finally {
      await client.close();
    }
  });

program.parse();

export { HandelsregisterClient, parseSearchResults, parseAnnouncements };
