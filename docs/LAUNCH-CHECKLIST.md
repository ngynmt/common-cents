# Launch Checklist

Pre-launch checklist for Common Cents. Covers infrastructure upgrades, API keys, and monitoring needed before driving public traffic to the site.

---

## Critical Fixes (already implemented)

These code changes have been made and are ready to deploy:

| Fix | Files Changed | Impact |
|-----|---------------|--------|
| Campaign finance API cascade | `api/campaign-finance/route.ts` | FEC calls reduced from ~12 to ~4 per representative (early exit on first cycle with data) |
| Rate limit memory leak | `lib/redis.ts` | Bounded Map (10K cap) with periodic eviction replaces unbounded Record |
| Redis graceful degradation | `lib/redis.ts` | All Redis ops catch errors and fall through to in-memory — app survives Redis outages |
| Geocodio result caching | `lib/redis.ts`, `api/representatives/route.ts` | ZIP→reps cached 24h in Redis (in-memory fallback). Repeat lookups skip Geocodio. |
| Lobbying query parallelization | `api/lobbying/route.ts` | 3-year queries run via `Promise.all()` instead of serial loop (~3x faster) |
| Function timeouts | `vercel.json` | campaign-finance: 30s, lobbying/contractor-influence: 15s |
| Bundle optimization | `next.config.ts` | `optimizePackageImports` for Recharts and Framer Motion |

---

## Before Launch (required)

### 1. Upgrade Upstash Redis

- **Why:** Free tier = 10,000 commands/day. A single page load triggers ~160 Redis commands (engagement counters + rate limit checks). At 100 users/day you're fine; at 1,000+ you'll exhaust the quota.
- **Action:** Go to [upstash.com](https://upstash.com) → your database → Billing → switch to Pay-as-you-go ($0.20 per 100K commands).
- **Set a daily budget alert** so you get notified before costs spike.

**Cost estimates:**

| Scale | Commands/day | Monthly cost |
|-------|-------------|-------------|
| 1K users/day | ~160K | ~$10 |
| 10K users/day | ~1.6M | ~$100 |
| 100K users/day | ~16M | ~$1,000 |

### 2. Get API Keys

All of these are free and instant to obtain. Set them as environment variables in Vercel (Settings → Environment Variables).

| Key | Sign up | Free tier | Notes |
|-----|---------|-----------|-------|
| `GEOCODIO_API_KEY` | [geocod.io](https://www.geocod.io) | 2,500 lookups/day | With caching, repeat ZIPs don't count. Upgrade to paid ($50/mo) if >2,500 unique ZIPs/day. |
| `FEC_API_KEY` | [api.data.gov/signup](https://api.data.gov/signup/) | 1,000 req/hr | Instant approval. Without this, DEMO_KEY has stricter limits. |
| `CONGRESS_API_KEY` | [api.congress.gov/sign-up](https://api.congress.gov/sign-up/) | Generous (no published cap) | Instant approval. Without this, bills endpoint may return empty. |
| `LDA_API_KEY` | [lda.senate.gov/api/register](https://lda.senate.gov/api/register/) | No published cap | Required for lobbying data (Follow the Money). |

### 3. Upgrade Vercel to Pro ($20/mo)

- **Why:** Free tier has a 10-second function timeout and 12 concurrent serverless instances. The campaign-finance endpoint can take up to 30s under load, and you need more concurrency for traffic spikes.
- **Pro gives you:** 60s timeout, 100 concurrent instances, 1TB bandwidth.
- **Action:** Go to [vercel.com](https://vercel.com) → your project → Settings → General → upgrade plan.

### 4. Verify Environment Variables

Confirm all of these are set in Vercel (Settings → Environment Variables → Production):

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
GEOCODIO_API_KEY=...
FEC_API_KEY=...
CONGRESS_API_KEY=...
LDA_API_KEY=...
```

Optional (analytics — app works without these):
```
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=...
```

### 5. Deploy and Smoke Test

After setting env vars, trigger a fresh deploy and verify:

- [ ] Enter a ZIP code → representatives load (not fallback)
- [ ] Click "Follow the Money" on a bill → lobbying + finance data appears
- [ ] "Recent Spending" tab → contracts and spending trends load
- [ ] Support/oppose buttons → counters increment
- [ ] Check Vercel function logs for any errors

---

## After Launch (recommended)

### 6. Set Up Monitoring Alerts

| Service | What to monitor | Alert threshold |
|---------|----------------|-----------------|
| Upstash | Daily command count | 80% of budget cap |
| Geocodio | Daily lookup count | 2,000 (80% of free tier) |
| Vercel | Function error rate (429s, 504s) | >5% of requests |
| Vercel | Function duration (p95) | >10s |

### 7. Soft Rollout

Don't send all your traffic at once. Recommended ramp:

1. **Day 1:** Share with ~1,000 users. Monitor Vercel logs + Upstash dashboard for 24h.
2. **Day 2-3:** If stable, open to ~10,000 users. Watch for FEC rate limiting (429 errors in logs).
3. **Day 4+:** Full public launch.

### 8. Cost Monitoring

After 1 week of traffic, review actual costs vs. projections:

| Service | Where to check |
|---------|---------------|
| Upstash | upstash.com → Database → Usage |
| Geocodio | dash.geocod.io → Usage |
| Vercel | vercel.com → Project → Usage |

---

## Traffic Projection Scenarios

| Scale | Geocodio | Upstash | FEC | Vercel | Est. Monthly Total |
|-------|----------|---------|-----|--------|--------------------|
| 1K users/day | Free | ~$10 | Free | Free | ~$10 |
| 10K users/day | ~$45 | ~$100 | Free (may rate-limit) | Pro $20 | ~$165 |
| 100K users/day | ~$450 | ~$1,000 | Free (needs caching) | Pro $20+ | ~$1,500 |

---

### 9. Periodic Data Updates

Run annually (after OECD publishes new COFOG data, typically mid-year):

```bash
npm run intl:update          # Fetch OECD ratios + World Bank indicators
npm run enrich -- --outcomes-only  # Generate editorial callouts
```

Review the generated callouts in `src/data/international-outcomes.json` before committing.

---

## Known Limitations at Scale

- **FEC API:** 1,000 req/hr even with a real key. At >10K users/day, some finance cards may show empty. Future fix: cache FEC results in Redis by candidate ID.
- **In-memory rate limiting:** Rate limit state is per-serverless-instance, not global. Redis-backed rate limiting (already implemented) handles this when Redis is available. If Redis goes down, rate limits become per-instance (less effective but still functional).
- **Senate LDA API:** No published rate limit, but may throttle under heavy load. Lobbying data is cached via ISR (24h).
