import type { FailureReason } from '../types.js';
import type { FetchLike } from '../AIProvider.js';
import { redactSecrets } from '../../utils/redact.js';
import { truncate } from '../../utils/text.js';

export type HttpJsonResult =
  | { ok: true; json: unknown }
  | { ok: false; reason: FailureReason; detail: string };

/** POSTs JSON with a hard timeout and maps every failure mode to a FailureReason. Never throws. */
export async function postJson(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<HttpJsonResult> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') return { ok: false, reason: 'timeout', detail: `no response within ${timeoutMs}ms` };
    return { ok: false, reason: 'network', detail: redactSecrets(truncate(err instanceof Error ? err.message : String(err), 200)) };
  }

  if (!res.ok) {
    let snippet = '';
    try {
      snippet = truncate(await res.text(), 200);
    } catch {
      /* ignore */
    }
    const reason: FailureReason = res.status === 429 ? 'rate_limited' : 'http_error';
    return { ok: false, reason, detail: redactSecrets(`HTTP ${res.status} ${snippet}`.trim()) };
  }

  try {
    return { ok: true, json: await res.json() };
  } catch {
    return { ok: false, reason: 'invalid_output', detail: 'response body was not JSON' };
  }
}
