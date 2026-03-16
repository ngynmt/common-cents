/**
 * Claude API wrapper for enriching contract descriptions and spending trends.
 * Uses Haiku for cost efficiency — each call costs fractions of a cent.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

interface MessageResponse {
  content: Array<{ type: string; text?: string }>;
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`  Claude API error ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data: MessageResponse = await res.json();
    const text = data.content?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    console.error(`  Claude API call failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Generates a plain-English summary of a federal contract.
 * Returns the raw description unchanged on failure.
 */
export async function enrichContractDescription(
  rawDescription: string,
  recipientName: string,
  agency: string,
  apiKey: string,
): Promise<string> {
  if (!rawDescription || rawDescription.length < 10) return rawDescription;

  const system = `You rewrite federal contract descriptions into plain English for a general audience.
Be concise (1-2 sentences, under 150 characters). Focus on what the contract actually pays for.
Do not include dollar amounts. Do not start with "This contract" — just describe what it funds.`;

  const user = `Contract awarded to ${recipientName} by ${agency}.

Raw description: ${rawDescription}`;

  const result = await callClaude(system, user, apiKey);
  return result || rawDescription;
}

/**
 * Generates a "why it matters" explanation for a spending anomaly.
 * Returns null on failure.
 */
export async function enrichSpendingAnomaly(
  classification: string,
  changePercent: number,
  currentFytd: number,
  priorFytd: number,
  type: "receipt" | "outlay",
  apiKey: string,
): Promise<string | null> {
  const direction = changePercent > 0 ? "increased" : "decreased";
  const absChange = Math.abs(changePercent);
  const currentB = (currentFytd / 1e9).toFixed(1);
  const priorB = (priorFytd / 1e9).toFixed(1);
  const typeLabel = type === "receipt" ? "revenue" : "spending";

  const system = `You explain federal spending and revenue changes to everyday taxpayers.
Respond with ONLY 1-2 plain sentences. No headers, no markdown, no bullet points, no notes.
Cite the most likely cause and what it means for taxpayers.
Do not speculate wildly — stick to well-known policy changes, economic conditions, or legislation.
Write at an 8th-grade reading level.`;

  const user = `Federal ${typeLabel} category "${classification}" has ${direction} by ${absChange}% year-over-year.
Current fiscal year to date: $${currentB}B. Same period last year: $${priorB}B.

Why did this change? What does it mean for taxpayers?`;

  return callClaude(system, user, apiKey);
}

/**
 * Generates an editorial callout comparing a country's outcomes to the US.
 * Returns null on failure.
 */
export async function enrichOutcomeCallout(
  categoryName: string,
  countryName: string,
  usRatio: number,
  countryRatio: number,
  formattedIndicators: string,
  apiKey: string,
): Promise<string | null> {
  const system = `You are writing factual editorial callouts for a civic transparency app that shows US taxpayers how their money is spent compared to other countries.

Write a 1-2 sentence callout that contrasts the spending ratio with the outcomes. Lead with what the other country achieves, then contrast with the US. Use specific numbers. Be factual and precise — let the numbers make the argument. Do not editorialize beyond the data. No hedging language.`;

  const user = `Category: ${categoryName}
Country: ${countryName}
US spending ratio: ${(usRatio * 100).toFixed(1)}% of budget
${countryName} spending ratio: ${(countryRatio * 100).toFixed(1)}% of budget

Indicators:
${formattedIndicators}`;

  return callClaude(system, user, apiKey);
}

/** Small delay to avoid hammering the API */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
