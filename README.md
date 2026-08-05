# monitor.ai

**AI Global Intelligence Stream** — Real-time AI signal aggregation with bilingual switching.

## Data Sources

| Source | Type | Provider ID | Credibility |
|--------|------|-------------|-------------|
| [Hacker News](https://news.ycombinator.com) | Top AI-related stories | `hackernews` | 3/5 |
| [HuggingFace Daily Papers](https://huggingface.co/papers) | Daily AI papers | `huggingface` | 4/5 |
| [GitHub Trending](https://github.com/search) | Trending AI repos | `github` | 3/5 |
| [Semantic Scholar](https://www.semanticscholar.org) | AI research papers | `semanticscholar` | 4/5 |

Data flow: each source is wrapped as a `SignalProvider` (`src/lib/sources/`). The `/api/signals` endpoint fetches all providers in parallel with `Promise.allSettled`, deduplicates, and applies category/language filters. A fallback chain ensures availability:

1. **Real data** from all successful providers
2. **Stale cache** if all providers fail (up to 5 min old)
3. **Mock data** only as last resort (tagged with `"fallback": "mock"` in response)

Explicit mock mode: `?mock=1` on `/api/signals` returns only mock data for debugging.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | GitHub personal access token (increases API rate limit from 60 to 5000 req/hr) |
| `NEXT_PUBLIC_API_URL` | No | API base URL (defaults to same origin) |

For deploy scripts, set these environment variables instead of hardcoding credentials:

```powershell
$env:MONITOR_AI_SERVER_IP = "your.server.ip"
$env:MONITOR_AI_SERVER_PASSWORD = "your-password"
```

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- date-fns
- vitest (testing)

## Development

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Build for production (standalone output + static assets copy)
npm run build

# Run tests
npm run test

# Start production server
npm run start:prod
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  app/              # Next.js App Router pages & API routes
    api/signals/    # Main signals aggregation endpoint (provider-based)
    api/github-trending/  # GitHub trending repos (lightweight)
    api/ai-papers/        # Semantic Scholar papers (lightweight)
  components/       # UI components (unchanged from original)
  data/             # Static data (mock signals, leaderboard)
  lib/
    sources/        # SignalProvider implementations
      types.ts      # Provider interface
      hackernews.ts
      huggingface.ts
      github.ts
      semanticscholar.ts
      index.ts      # Provider registry
    normalizer.ts   # Signal normalization per source
    data-freshness.ts  # Source health tracker
    fetch-with-timeout.ts  # Fetch wrapper with timeout
  types/
    signal.ts       # Signal data model
```

## Verification

- `npm run build` must exit with code 0
- `/api/signals` returns real data (see `"sourceHealth"` in response)
- Mock data never mixes into normal results (only as `fallback: 'mock'`)
- External source failures are reported via `sourceHealth` and `SourceHealthPanel`

## World Bank Macro Indicators

The **Macro Indicators** module provides US–China AI industry context via the [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation).

### Data Sources

| Indicator | Code | Source |
|-----------|------|--------|
| GDP (current US$) | `NY.GDP.MKTP.CD` | World Bank |
| R&D expenditure (% of GDP) | `GB.XPD.RSDV.GD.ZS` | UNESCO |
| Researchers in R&D (per million) | `SP.POP.SCIE.RD.P6` | UNESCO |
| Internet users (% of population) | `IT.NET.USER.ZS` | ITU |
| Education expenditure (% of GDP) | `SE.XPD.TOTL.GD.ZS` | UNESCO |
| High-tech exports (% of manufactured) | `TX.VAL.TECH.MF.ZS` | UN Comtrade |
| Trade (% of GDP) | `NE.TRD.GNFS.ZS` | World Bank |

### API Usage

```
GET /api/indicators?indicator=NY.GDP.MKTP.CD&countries=USA,CHN&yearStart=2010&yearEnd=2023
GET /api/indicators?action=list       # List all preset indicators
GET /api/indicators?action=search&q=gdp  # Search indicators
```

### Data Model

See `src/types/indicator.ts` — `IndicatorMeta`, `IndicatorValue`, `IndicatorResponse`.
This model is designed for future integration with PostgreSQL, ECharts, and LangGraph QA pipelines.

### License

The World Bank Indicators API is free and open for non-commercial and commercial use under the [World Bank Terms of Use](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets). No wb_dashboard code has been copied or reused.

### Offline Snapshot

The project includes a **pre-built data snapshot** (`src/data/wb-snapshot.json`) covering 7 indicators × 8 countries × 14 years. The snapshot is loaded at build time, so the app works **without internet access** (no proxy/VPN needed on the server).

To regenerate the snapshot (e.g., for newer data):

```bash
# Requires internet / proxy on the build machine
node scripts/generate-wb-snapshot.js
```

The `fetchIndicatorData` function in `src/lib/sources/worldbank.ts` loads snapshot first; if the requested indicator is not in the snapshot, it falls back to the live World Bank API.
