#!/usr/bin/env node

import { program } from 'commander';
import { HandelsregisterClient } from './client.js';
import { parseSearchResults } from './parser.js';

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

program.parse();

export { HandelsregisterClient, parseSearchResults };
