import * as cheerio from 'cheerio';

/**
 * Parse the label text from an announcement link.
 * Format (with <br> or spaces): "Category  State Court REG  Company Name – Location"
 * @param {string} labelText
 * @returns {Object}
 */
function parseAnnouncementLabel(labelText) {
  const trimmed = labelText.trim();
  // Split by 2+ spaces (cheerio .text() strips <br> to space)
  const parts = trimmed.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);

  let category = '';
  let court = '';
  let name = '';
  let location = '';

  // Last part is "Company Name – Location"
  const lastPart = parts[parts.length - 1] ?? '';
  const dashIdx = lastPart.indexOf(' – ');
  if (dashIdx >= 0) {
    name = lastPart.slice(0, dashIdx).trim();
    location = lastPart.slice(dashIdx + 3).trim();
  } else {
    name = lastPart;
  }

  // First part is category
  category = parts[0] ?? '';
  // Middle part(s) are court (State Amtsgericht Court REG NUM)
  if (parts.length >= 2) {
    court = parts.slice(1, -1).join(' ').trim();
  }

  return {
    category,
    court,
    name,
    location,
  };
}

/**
 * Parse Registerbekanntmachungen (register announcements) HTML.
 * @param {string} html - Raw HTML from the announcements page
 * @returns {Array<Object>} Array of announcement objects
 */
export function parseAnnouncements(html) {
  const $ = cheerio.load(html);
  const datalist = $('dl[id*="datalistId_list"]');
  if (!datalist.length) return [];

  const results = [];
  let currentDate = '';

  datalist.find('dt, dd').each((_, el) => {
    const $el = $(el);
    if (el.name === 'dt') {
      currentDate = $el.find('span').text().trim() || $el.text().trim();
      return;
    }
    if (el.name === 'dd') {
      $el.find('a.ui-commandlink label').each((__, labelEl) => {
        const labelText = $(labelEl).text().trim();
        if (!labelText) return;
        const parsed = parseAnnouncementLabel(labelText);
        results.push({
          date: currentDate,
          ...parsed,
        });
      });
    }
  });

  return results;
}
