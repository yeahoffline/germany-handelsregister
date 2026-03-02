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
handelsregister search -s "deutsche bahn" -so all
handelsregister search -s "Gasag AG" -so exact --json
handelsregister search -s "Gasag AG" -f   # force fresh request, bypass cache
```

**Options:**

| Option | Description |
|--------|-------------|
| `-s, --schlagwoerter <keywords>` | Search keywords (required) |
| `-o, --schlagwort-optionen <option>` | `all` (contain all keywords), `min` (at least one), `exact` (exact company name). Default: `all` |
| `-f, --force` | Bypass cache, always fetch fresh from the portal |
| `--json` | Output results as JSON |
| `-d, --debug` | Enable debug logging |

### Programmatic Use

```javascript
import { HandelsregisterClient, parseSearchResults } from 'germany-handelsregister';

const client = new HandelsregisterClient({ debug: false });
await client.openStartpage();

const companies = await client.search({
  schlagwoerter: 'deutsche bahn',
  schlagwortOptionen: 'all',
  force: false,  // use cache if available
});

await client.close();
console.log(companies);
```

## Cache

Results are cached in `os.tmpdir()/handelsregister_cache/`. Use `-f` or `force: true` to bypass the cache.

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
