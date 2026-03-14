/**
 * Structured logging for API routes.
 * Outputs JSON to stdout for queryability in Vercel Logs.
 */

interface LogFields {
  route: string;
  event: string;
  dependency?: string;
  latency_ms?: number;
  success?: boolean;
  status_code?: number;
  error?: string;
  [key: string]: string | number | boolean | undefined;
}

export function logApi(fields: LogFields): void {
  const entry: Record<string, string | number | boolean> = {
    timestamp: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) entry[k] = v;
  }
  console.log(JSON.stringify(entry));
}

/**
 * Wraps a fetch call with latency tracking and structured logging.
 * Returns the Response on success, or null on failure (logged automatically).
 */
export async function trackedFetch(
  url: string,
  route: string,
  dependency: string,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<Response | null> {
  const start = performance.now();
  try {
    const res = await fetch(url, init);
    const latency_ms = Math.round(performance.now() - start);

    if (!res.ok) {
      logApi({
        route,
        event: "external_api_error",
        dependency,
        latency_ms,
        status_code: res.status,
        success: false,
      });
      return null;
    }

    logApi({
      route,
      event: "external_api_call",
      dependency,
      latency_ms,
      status_code: res.status,
      success: true,
    });
    return res;
  } catch (err) {
    const latency_ms = Math.round(performance.now() - start);
    logApi({
      route,
      event: "external_api_error",
      dependency,
      latency_ms,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
