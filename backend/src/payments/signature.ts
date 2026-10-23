import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Hex HMAC-SHA256 over the raw request bytes.
 * Constant-time comparison to avoid timing oracles (OWASP A02).
 */
export function verifySignature(
  rawBody: Buffer,
  header: string | string[] | undefined,
  secret: string,
): boolean {
  if (typeof header !== 'string' || header.length === 0) return false;
  // Strict: hex only, even length.
  if (!/^[0-9a-f]+$/i.test(header) || header.length % 2 !== 0) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(header, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}