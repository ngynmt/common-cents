# Load Tests

Simulates realistic user traffic to surface rate limiting, Redis quota, and function timeout issues before launch.

## Setup

```bash
# macOS
brew install k6

# Or download from https://k6.io/docs/get-started/installation/
```

## Usage

```bash
# Against local dev server (start `npm run dev` first)
k6 run load-tests/smoke.js

# Against staging/preview deploy
k6 run -e BASE_URL=https://your-preview.vercel.app load-tests/smoke.js

# Against production (use caution — will consume API quotas)
k6 run -e BASE_URL=https://commoncents.app load-tests/smoke.js
```

## Test Profiles

### smoke.js (default)
Ramps 1 → 10 → 50 users over 3 minutes. Use this to verify basic functionality under light load.

### stress.js
Ramps 10 → 100 → 500 users over 8 minutes. Use this to find breaking points (rate limits, timeouts, Redis quota).

## What to Watch

While tests run, monitor:
- **Vercel Functions tab** — look for 429s and 504s
- **Upstash dashboard** — watch command count climb
- **k6 output** — check `http_req_failed` rate and `http_req_duration` p95
