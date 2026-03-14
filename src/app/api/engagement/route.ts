import { NextRequest, NextResponse } from "next/server";
import { incrementCounter, getCounters, keys, checkRateLimit } from "@/lib/redis";
import { pendingBills } from "@/data/pending-bills";
import { logApi } from "@/lib/api-logger";

const validBillIds = new Set(pendingBills.map((b) => b.id));

/**
 * GET /api/engagement?bills=id1,id2,id3
 *
 * Returns engagement counts for the specified bills.
 */
export async function GET(request: NextRequest) {
  const billIds = request.nextUrl.searchParams.get("bills")?.split(",") ?? [];

  // Validate bill IDs
  const validIds = billIds.filter((id) => validBillIds.has(id));
  if (validIds.length === 0) {
    return NextResponse.json({ counts: {} });
  }

  // Build all keys we need
  const allKeys: string[] = [];
  for (const id of validIds) {
    allKeys.push(keys.billSupport(id));
    allKeys.push(keys.billOppose(id));
    allKeys.push(keys.billContacted(id));
  }

  const raw = await getCounters(allKeys);

  // Reshape into a friendlier format
  const counts: Record<string, { support: number; oppose: number; contacted: number }> = {};
  for (const id of validIds) {
    counts[id] = {
      support: raw[keys.billSupport(id)] || 0,
      oppose: raw[keys.billOppose(id)] || 0,
      contacted: raw[keys.billContacted(id)] || 0,
    };
  }

  return NextResponse.json({ counts });
}

/**
 * POST /api/engagement
 *
 * Increment an engagement counter.
 * Body: { billId: string, action: "support" | "oppose" | "contacted" }
 */
export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const { allowed, retryAfterSeconds } = await checkRateLimit(ip);
  if (!allowed) {
    logApi({ route: "/api/engagement", event: "rate_limit_hit" });
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } },
    );
  }

  const body = await request.json();
  const { billId, action } = body;

  if (!billId || !validBillIds.has(billId)) {
    return NextResponse.json({ error: "Invalid bill ID" }, { status: 400 });
  }

  if (!["support", "oppose", "contacted"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  let key: string;
  switch (action) {
    case "support":
      key = keys.billSupport(billId);
      break;
    case "oppose":
      key = keys.billOppose(billId);
      break;
    case "contacted":
      key = keys.billContacted(billId);
      break;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const newCount = await incrementCounter(key);

  return NextResponse.json({ count: newCount });
}
