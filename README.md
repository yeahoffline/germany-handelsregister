# germany-handelsregister

Node.js CLI and library for the [Handelsregister](https://www.handelsregister.de) (German commercial register) portal. Query company data without using a web browser.

Inspired by [bundesAPI/handelsregister](https://github.com/bundesAPI/handelsregister) (Python).

## Installation

```bash
npm install
npx playwright install chromium
```

Or use the CLI via npx:

```bash
npx germany-handelsregister search -s "deutsche bahn"
```

## Usage

### CLI

```bash
handelsregister search -s "deutsche bahn" -o all
handelsregister search -s "Gasag AG" -o exact --json
handelsregister search -s "Gasag AG" -f   # force fresh request, bypass cache
```

**Search options:**

| Option | Description |
|--------|-------------|
| `-s, --schlagwoerter <keywords>` | Search keywords (required) |
| `-o, --schlagwort-optionen <option>` | `all` (contain all keywords), `min` (at least one), `exact` (exact company name). Default: `all` |
| `-f, --force` | Bypass cache, always fetch fresh from the portal |
| `--json` | Output results as JSON |
| `-d, --debug` | Enable debug logging |

### Registerbekanntmachungen (announcements)

Search register announcements – newly published changes including new company registrations, transformations, deletions, etc. Covers the last 8 weeks per § 10 HGB.

```bash
handelsregister announcements                    # last 7 days, all Germany
handelsregister announcements --from 01.02.2026 --to 15.02.2026
handelsregister announcements --bundesland BE   # Berlin only
handelsregister announcements --kategorie 3     # Einreichung neuer Dokumente
handelsregister announcements --json
```

**Announcements options:**

| Option | Description |
|--------|-------------|
| `--from <date>` | Start date (dd.MM.yyyy). Default: 7 days ago |
| `--to <date>` | End date (dd.MM.yyyy). Default: today |
| `--bundesland <code>` | BW, BY, BE, BR, HB, HH, HE, MV, NI, NW, RP, SL, SN, ST, SH, TH. Default: all |
| `--kategorie <id>` | 1=Löschungsankündigung, 2=Umwandlungsgesetz, 3=Einreichung neuer Dokumente, 4=Sonstige |
| `-f, --force` | Bypass cache |
| `--json` | Output as JSON |

### Programmatic Use

**Company search:**

```javascript
import { HandelsregisterClient, parseSearchResults } from 'germany-handelsregister';

const client = new HandelsregisterClient({ debug: false });
await client.openStartpage();

const companies = await client.search({
  schlagwoerter: 'deutsche bahn',
  schlagwortOptionen: 'all',
  force: false,
});

await client.close();
console.log(companies);
```

**Register announcements:**

```javascript
import { HandelsregisterClient, parseAnnouncements } from 'germany-handelsregister';

const client = new HandelsregisterClient();
await client.openStartpage();

const announcements = await client.searchAnnouncements({
  dateFrom: '01.02.2026',
  dateTo: '15.02.2026',
  bundesland: '',  // all states
  kategorie: '',   // all categories
  force: false,
});

await client.close();
console.log(announcements);
```

## Cache

- Company search: `os.tmpdir()/handelsregister_cache/`
- Announcements: `os.tmpdir()/handelsregister_announcements_cache/`

Use `-f` or `force: true` to bypass the cache.

## Rate Limit

The Handelsregister portal enforces a limit of **60 requests per hour** per the [Nutzungsordnung](https://www.handelsregister.de). Stay within this limit to avoid blocking.

## Troubleshooting

- **Timeout**: The portal can be slow to load. The initial request uses a 60s timeout.
- **Form errors**: The site structure may change. If searches fail, check for updates to this package.

## Requirements

- Node.js 18+
- Playwright Chromium (installed via `npx playwright install chromium`)

## Development

```bash
npm test
```

## License

MIT
