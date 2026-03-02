import * as cheerio from 'cheerio';

const REGISTER_NUM_REGEX = /(HRA|HRB|GnR|VR|PR)\s*\d+(\s+[A-Z])?(?!\w)/;
const SUFFIX_MAP = {
  Berlin: { HRB: ' B' },
  Bremen: { HRA: ' HB', HRB: ' HB', GnR: ' HB', VR: ' HB', PR: ' HB' },
};

/**
 * Parse a single result row (tr element) into a company object.
 * @param {cheerio.Cheerio} $row - Cheerio wrapped tr element
 * @returns {Object} Company result with court, register_num, name, state, status, etc.
 */
function parseResult($, $row) {
  const cells = [];
  $row.find('td').each((_, el) => {
    cells.push($(el).text().trim());
  });

  const court = cells[1] ?? '';
  const regMatch = court.match(REGISTER_NUM_REGEX);
  let registerNum = regMatch ? regMatch[0] : null;

  const state = cells[3] ?? '';
  const statusRaw = (cells[4] ?? '').trim();
  const statusCurrent = statusRaw.toUpperCase().replace(/\s+/g, '_');

  if (registerNum && state) {
    const regType = registerNum.split(/\s+/)[0];
    const suffix = SUFFIX_MAP[state]?.[regType];
    if (suffix && !registerNum.endsWith(suffix)) {
      registerNum += suffix;
    }
  }

  const documents = (cells[5] ?? '').replace(/\s/g, '');
  const history = [];
  let histStart = 8;

  for (let i = histStart; i < cells.length; i += 3) {
    if (i + 1 >= cells.length) break;
    const cell = cells[i] ?? '';
    if (cell.includes('Branches') || cell.includes('Niederlassungen')) break;
    history.push([cells[i], cells[i + 1]]);
  }

  return {
    court,
    register_num: registerNum,
    name: cells[2] ?? '',
    state,
    status: statusRaw,
    statusCurrent,
    documents,
    history,
  };
}

/**
 * Parse search results HTML and extract company entries.
 * @param {string} html - Raw HTML from the search results page
 * @returns {Array<Object>} Array of company result objects
 */
export function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const grid = $('table[role="grid"]');
  if (!grid.length) return [];

  const results = [];
  grid.find('tr').each((_, el) => {
    const $row = $(el);
    if ($row.attr('data-ri') == null) return;
    results.push(parseResult($, $row));
  });
  return results;
}
