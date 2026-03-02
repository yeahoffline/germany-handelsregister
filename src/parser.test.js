import { describe, it, expect } from 'vitest';
import { parseSearchResults } from './parser.js';

const TEST_HTML = `
<table role="grid">
  <tr data-ri="0">
    <td></td>
    <td>Berlin District court Berlin (Charlottenburg) HRB 44343</td>
    <td>GASAG AG</td>
    <td>Berlin</td>
    <td>currently registered</td>
    <td>AD CD HD DK UT VÖ SI</td>
    <td></td>
    <td></td>
    <td>1.) Gasag Berliner Gaswerke Aktiengesellschaft</td>
    <td>1.) Berlin</td>
  </tr>
</table>
`;

describe('parseSearchResults', () => {
  it('parses search result HTML into company objects', () => {
    const res = parseSearchResults(TEST_HTML);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      court: 'Berlin District court Berlin (Charlottenburg) HRB 44343',
      register_num: 'HRB 44343 B',
      name: 'GASAG AG',
      state: 'Berlin',
      status: 'currently registered',
      statusCurrent: 'CURRENTLY_REGISTERED',
      documents: 'ADCDHDDKUTVÖSI',
      history: [['1.) Gasag Berliner Gaswerke Aktiengesellschaft', '1.) Berlin']],
    });
  });

  it('returns empty array when no grid table found', () => {
    const res = parseSearchResults('<html><body><p>No results</p></body></html>');
    expect(res).toEqual([]);
  });

  it('skips rows without data-ri attribute', () => {
    const html = `
      <table role="grid">
        <tr><td>header</td></tr>
        <tr data-ri="0"><td></td><td>Court</td><td>Name</td><td>State</td><td>Status</td><td></td><td></td><td></td></tr>
      </table>
    `;
    const res = parseSearchResults(html);
    expect(res).toHaveLength(1);
  });
});
