import { describe, it, expect } from 'vitest';
import { parseAnnouncements } from './announcements-parser.js';

const SAMPLE_HTML = `
<form id="bekanntMachungenForm">
<dl id="bekanntMachungenForm:datalistId_list" class="ui-datalist-data">
  <dt class="ui-datalist-item"><span>02.03.2026</span></dt>
  <dd>
    <a class="ui-commandlink"><label>Löschungsankündigung  <br>  Baden-Württemberg Amtsgericht Mannheim HRB 220084  <br> A.u.W.Tisch GmbH – Achern</label></a>
    <a class="ui-commandlink"><label>Registerbekanntmachung nach dem Umwandlungsgesetz  <br>  Hamburg Amtsgericht Hamburg HRB 43002  <br> ABACON CAPITAL GmbH – Hamburg</label></a>
  </dd>
  <dt class="ui-datalist-item"><span>01.03.2026</span></dt>
  <dd>
    <a class="ui-commandlink"><label>Einreichung neuer Dokumente  <br>  Berlin Amtsgericht Berlin (Charlottenburg) HRB 12345  <br> Test GmbH – Berlin</label></a>
  </dd>
</dl>
</form>
`;

describe('parseAnnouncements', () => {
  it('parses announcement HTML into structured objects', () => {
    const res = parseAnnouncements(SAMPLE_HTML);
    expect(res).toHaveLength(3);
    expect(res[0]).toEqual({
      date: '02.03.2026',
      category: 'Löschungsankündigung',
      court: 'Baden-Württemberg Amtsgericht Mannheim HRB 220084',
      name: 'A.u.W.Tisch GmbH',
      location: 'Achern',
    });
    expect(res[1].name).toBe('ABACON CAPITAL GmbH');
    expect(res[1].location).toBe('Hamburg');
    expect(res[2].date).toBe('01.03.2026');
  });

  it('returns empty array when no datalist found', () => {
    const res = parseAnnouncements('<html><body>No data</body></html>');
    expect(res).toEqual([]);
  });
});
