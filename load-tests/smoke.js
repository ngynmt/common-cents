import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const repsDuration = new Trend("reps_duration", true);
const financeDuration = new Trend("finance_duration", true);
const lobbyingDuration = new Trend("lobbying_duration", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Realistic ZIP codes across different states
const ZIP_CODES = [
  "90210", // CA - Beverly Hills
  "10001", // NY - Manhattan
  "60601", // IL - Chicago
  "77001", // TX - Houston
  "33101", // FL - Miami
  "98101", // WA - Seattle
  "02101", // MA - Boston
  "30301", // GA - Atlanta
  "85001", // AZ - Phoenix
  "80201", // CO - Denver
];

// Bill numbers for lobbying lookups
const BILLS = ["S. 770", "H.R. 2474", "S. 1832", "H.R. 6166"];

// Rep names for campaign finance search
const REP_NAMES = [
  "Nancy Pelosi",
  "Ted Cruz",
  "Bernie Sanders",
  "Marco Rubio",
];

export const options = {
  stages: [
    { duration: "30s", target: 5 },   // Warm up
    { duration: "1m", target: 10 },   // Light load
    { duration: "1m", target: 50 },   // Moderate load
    { duration: "30s", target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ["p(95)<10000"],       // p95 < 10s
    reps_duration: ["p(95)<5000"],            // Reps endpoint < 5s
    errors: ["rate<0.2"],                     // <20% custom error rate (excludes expected 429s)
  },
};

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  // Simulate a realistic user flow:
  // 1. Load page → 2. Enter ZIP → 3. Browse bills → 4. Check Follow the Money

  group("1. Page load", () => {
    const res = http.get(`${BASE_URL}/`);
    check(res, {
      "page loads": (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(1 + Math.random() * 2); // Think time

  // 2. Enter ZIP → fetch representatives
  let reps = [];
  group("2. ZIP lookup", () => {
    const zip = randomItem(ZIP_CODES);
    const res = http.get(`${BASE_URL}/api/representatives?zip=${zip}`);
    repsDuration.add(res.timings.duration);

    const ok = check(res, {
      "reps status 200 or 429": (r) => r.status === 200 || r.status === 429,
      "reps has data or fallback": (r) => {
        if (r.status === 429) return true;
        const body = r.json();
        return body.representatives !== undefined || body.fallback === true;
      },
    });
    errorRate.add(!ok);

    if (res.status === 200) {
      try {
        const body = res.json();
        reps = body.representatives || [];
      } catch {
        // ignore parse errors
      }
    }
  });

  sleep(0.5 + Math.random());

  // 3. Fetch spending trends + contracts (happens on "Recent Spending" tab)
  group("3. Spending data", () => {
    const responses = http.batch([
      ["GET", `${BASE_URL}/api/spending-trends`],
      ["GET", `${BASE_URL}/api/contracts?days=180&min_amount=100000000&page=1`],
    ]);

    for (const res of responses) {
      check(res, {
        "spending status ok": (r) => r.status === 200 || r.status === 429,
      });
      errorRate.add(res.status !== 200 && res.status !== 429);
    }
  });

  sleep(0.5 + Math.random());

  // 4. Follow the Money — campaign finance + lobbying (only ~30% of users click this)
  if (Math.random() < 0.3) {
    group("4. Follow the Money", () => {
      const name = randomItem(REP_NAMES);
      const bill = randomItem(BILLS);

      const responses = http.batch([
        ["GET", `${BASE_URL}/api/campaign-finance?search=${encodeURIComponent(name)}`],
        ["GET", `${BASE_URL}/api/lobbying?bill=${encodeURIComponent(bill)}`],
      ]);

      const financeRes = responses[0];
      const lobbyingRes = responses[1];

      financeDuration.add(financeRes.timings.duration);
      lobbyingDuration.add(lobbyingRes.timings.duration);

      check(financeRes, {
        "finance status ok": (r) => r.status === 200 || r.status === 429,
      });
      check(lobbyingRes, {
        "lobbying status ok": (r) => r.status === 200 || r.status === 429,
      });

      errorRate.add(financeRes.status !== 200 && financeRes.status !== 429);
      errorRate.add(lobbyingRes.status !== 200 && lobbyingRes.status !== 429);
    });
  }

  // 5. Engagement counters (most users view, ~10% click)
  group("5. Engagement", () => {
    const res = http.get(
      `${BASE_URL}/api/engagement?bills=hr-2474-119,s-770-119,s-1832-119`
    );
    check(res, {
      "engagement status ok": (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(1 + Math.random() * 3); // Time between users
}
