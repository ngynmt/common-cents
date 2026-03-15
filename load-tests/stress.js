import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const rateLimited = new Counter("rate_limited");
const timeouts = new Counter("timeouts");
const repsDuration = new Trend("reps_duration", true);
const financeDuration = new Trend("finance_duration", true);
const lobbyingDuration = new Trend("lobbying_duration", true);
const contractsDuration = new Trend("contracts_duration", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const ZIP_CODES = [
  "90210", "10001", "60601", "77001", "33101",
  "98101", "02101", "30301", "85001", "80201",
  "94102", "20001", "75201", "32801", "97201",
  "55401", "48201", "19101", "28201", "37201",
];

const BILLS = ["S. 770", "H.R. 2474", "S. 1832", "H.R. 6166", "H.R. 4848"];

const REP_NAMES = [
  "Nancy Pelosi", "Ted Cruz", "Bernie Sanders", "Marco Rubio",
  "Alexandria Ocasio-Cortez", "Mitch McConnell", "Chuck Schumer",
  "Kevin McCarthy", "Elizabeth Warren", "Lindsey Graham",
];

export const options = {
  stages: [
    { duration: "30s", target: 10 },    // Warm up
    { duration: "1m", target: 50 },     // Ramp to moderate
    { duration: "2m", target: 100 },    // Sustained moderate
    { duration: "2m", target: 300 },    // Heavy load
    { duration: "1m", target: 500 },    // Peak stress
    { duration: "1m", target: 100 },    // Step down
    { duration: "30s", target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<15000"],       // p95 < 15s
    reps_duration: ["p(95)<8000"],            // Reps < 8s at p95
    errors: ["rate<0.35"],                    // <35% custom error rate (excludes expected 429s)
  },
};

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function trackResponse(res, name) {
  if (res.status === 429) {
    rateLimited.add(1);
  }
  if (res.status === 504 || res.timings.duration > 10000) {
    timeouts.add(1);
  }
  errorRate.add(res.status !== 200 && res.status !== 429);
}

export default function () {
  // Simulate realistic user journey with variable depth

  // 1. Page load (every user)
  group("1. Page load", () => {
    const res = http.get(`${BASE_URL}/`);
    check(res, { "page loads": (r) => r.status === 200 });
    trackResponse(res, "page");
  });

  sleep(0.5 + Math.random());

  // 2. ZIP lookup (90% of users)
  if (Math.random() < 0.9) {
    group("2. ZIP lookup", () => {
      const zip = randomItem(ZIP_CODES);
      const res = http.get(`${BASE_URL}/api/representatives?zip=${zip}`);
      repsDuration.add(res.timings.duration);
      check(res, {
        "reps ok or rate-limited": (r) => r.status === 200 || r.status === 429,
      });
      trackResponse(res, "reps");
    });

    sleep(0.3 + Math.random() * 0.5);

    // 3. Votes (80% of users who entered ZIP)
    if (Math.random() < 0.8) {
      group("3. Votes", () => {
        // Use a realistic bioguide ID pattern
        const res = http.get(
          `${BASE_URL}/api/votes?bioguideIds=p000197,f000062&lisIds=S270`
        );
        check(res, {
          "votes ok": (r) => r.status === 200 || r.status === 429,
        });
        trackResponse(res, "votes");
      });
    }
  }

  sleep(0.5 + Math.random());

  // 4. Spending tab (40% of users)
  if (Math.random() < 0.4) {
    group("4. Spending data", () => {
      const responses = http.batch([
        ["GET", `${BASE_URL}/api/spending-trends`],
        ["GET", `${BASE_URL}/api/contracts?days=180&min_amount=100000000&page=1`],
      ]);

      for (const res of responses) {
        contractsDuration.add(res.timings.duration);
        trackResponse(res, "spending");
      }
    });

    // Load more contracts (10% of spending tab viewers)
    if (Math.random() < 0.1) {
      sleep(0.5);
      group("4b. Load more contracts", () => {
        const res = http.get(
          `${BASE_URL}/api/contracts?days=180&min_amount=100000000&page=2`
        );
        trackResponse(res, "contracts-page2");
      });
    }
  }

  sleep(0.3 + Math.random());

  // 5. Follow the Money (20% of users)
  if (Math.random() < 0.2) {
    group("5. Follow the Money", () => {
      const name = randomItem(REP_NAMES);
      const bill = randomItem(BILLS);

      const responses = http.batch([
        ["GET", `${BASE_URL}/api/campaign-finance?search=${encodeURIComponent(name)}`],
        ["GET", `${BASE_URL}/api/lobbying?bill=${encodeURIComponent(bill)}`],
      ]);

      financeDuration.add(responses[0].timings.duration);
      lobbyingDuration.add(responses[1].timings.duration);

      for (const res of responses) {
        trackResponse(res, "influence");
      }
    });

    // Contractor influence (50% of Follow the Money users)
    if (Math.random() < 0.5) {
      sleep(0.5);
      group("5b. Contractor influence", () => {
        const res = http.get(
          `${BASE_URL}/api/contractor-influence?contractor=${encodeURIComponent("Lockheed Martin")}`
        );
        trackResponse(res, "contractor-influence");
      });
    }
  }

  // 6. Engagement counters (every user)
  group("6. Engagement", () => {
    const res = http.get(
      `${BASE_URL}/api/engagement?bills=hr-2474-119,s-770-119,s-1832-119`
    );
    trackResponse(res, "engagement");
  });

  // 7. Engagement action (5% of users click support/oppose)
  if (Math.random() < 0.05) {
    group("7. Engagement action", () => {
      const res = http.post(
        `${BASE_URL}/api/engagement`,
        JSON.stringify({
          billId: "hr-2474-119",
          action: Math.random() < 0.7 ? "support" : "oppose",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
      trackResponse(res, "engagement-action");
    });
  }

  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  const m = data.metrics;

  const rateLimitedCount = m.rate_limited ? m.rate_limited.values.count : 0;
  const timeoutCount = m.timeouts ? m.timeouts.values.count : 0;
  const totalReqs = m.http_reqs ? m.http_reqs.values.count : 0;
  const errorCount = m.errors ? m.errors.values.passes : 0;

  function p95(metric) {
    if (!metric || !metric.values) return "N/A";
    const val = metric.values["p(95)"];
    return val != null ? val.toFixed(0) + "ms" : "N/A";
  }

  function med(metric) {
    if (!metric || !metric.values) return "N/A";
    const val = metric.values.med;
    return val != null ? val.toFixed(0) + "ms" : "N/A";
  }

  function p99(metric) {
    if (!metric || !metric.values) return "N/A";
    const val = metric.values["p(99)"];
    return val != null ? val.toFixed(0) + "ms" : "N/A";
  }

  const errorPct = totalReqs > 0 ? ((errorCount / totalReqs) * 100).toFixed(1) : "0.0";
  const rateLimitPct = totalReqs > 0 ? ((rateLimitedCount / totalReqs) * 100).toFixed(1) : "0.0";

  const summary = `
=== STRESS TEST SUMMARY ===

Total requests:     ${totalReqs}
Real errors:        ${errorCount} (${errorPct}%)
Rate limited (429): ${rateLimitedCount} (${rateLimitPct}%)
Timeouts (504/10s): ${timeoutCount}

Response times:
  Median:  ${med(m.http_req_duration)}
  p95:     ${p95(m.http_req_duration)}
  p99:     ${p99(m.http_req_duration)}

Endpoint breakdown (p95):
  Representatives: ${p95(m.reps_duration)}
  Campaign finance: ${p95(m.finance_duration)}
  Lobbying:        ${p95(m.lobbying_duration)}
  Contracts:       ${p95(m.contracts_duration)}

=== RECOMMENDATIONS ===
${rateLimitedCount > totalReqs * 0.1 ? `! High rate limiting (${rateLimitPct}%) — consider raising limits or adding response caching` : "  Rate limiting within acceptable range"}
${timeoutCount > 10 ? `! ${timeoutCount} timeouts detected — check campaign-finance and lobbying endpoints` : "  No significant timeout issues"}
${errorCount > totalReqs * 0.05 ? `! Error rate above 5% — investigate failing endpoints` : "  Error rate acceptable"}
`;

  return {
    stdout: summary,
  };
}
