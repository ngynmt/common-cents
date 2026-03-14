import posthog from "posthog-js";

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    persistence: "localStorage",
    disable_session_recording: true,
  });
  initialized = true;
}

function capture(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

// --- Conversion / Activation ---

export function trackPageView(path: string, hasParams: boolean) {
  capture("page_view", { path, has_params: hasParams });
}

export function trackReceiptGenerated(filingStatus: string, hasZip: boolean) {
  capture("receipt_generated", { filing_status: filingStatus, has_zip: hasZip });
}

export function trackReceiptShared(method: "copy_url" | "native_share") {
  capture("receipt_shared", { method });
}

// --- User Engagement ---

export function trackCategoryToggled(category: string, expanded: boolean) {
  capture(expanded ? "category_expanded" : "category_collapsed", { category });
}

export function trackInternationalCompared(country: string) {
  capture("international_compared", { country });
}

// --- Civic Action ---

export function trackBillViewed(billId: string) {
  capture("bill_viewed", { bill_id: billId });
}

export function trackBillVoted(billId: string, action: "support" | "oppose") {
  capture("bill_voted", { bill_id: billId, action });
}

export function trackRepContactClicked(
  billId: string,
  contactMethod: "call" | "email",
  repChamber: string,
) {
  capture("rep_contact_clicked", {
    bill_id: billId,
    contact_method: contactMethod,
    rep_level: repChamber,
  });
}

export function trackRepLookedUp(state: string) {
  capture("rep_looked_up", { state });
}

export function trackRepsModalOpened() {
  capture("reps_modal_opened");
}
