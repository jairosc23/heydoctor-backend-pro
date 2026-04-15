import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const MAX_BODY_BYTES = 2048;
const NONCE_HEADER = 'x-hd-nonce';
const NONCE_MAX_LEN = 128;
const NONCE_TTL_MS = 60_000;

const nonceSeen = new Map<string, number>();

function pruneExpiredNonces(now: number): void {
  const drop: string[] = [];
  nonceSeen.forEach((exp, k) => {
    if (exp <= now) drop.push(k);
  });
  for (const k of drop) nonceSeen.delete(k);
}

type NonceCheck = 'ok' | 'replay' | 'bad';

function tryConsumeNonce(headerVal: string | null): NonceCheck {
  if (!headerVal?.trim()) return 'bad';
  const nonce = headerVal.trim();
  if (nonce.length > NONCE_MAX_LEN) return 'bad';
  const now = Date.now();
  pruneExpiredNonces(now);
  if (nonceSeen.has(nonce)) return 'replay';
  nonceSeen.set(nonce, now + NONCE_TTL_MS);
  return 'ok';
}

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Primer salto en `x-forwarded-for` (cliente típico detrás de Vercel/proxy). */
function clientIpFromForwardedFor(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (!xff?.trim()) return null;
  const first = xff.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function isIpAllowlisted(ip: string | null, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  return allowlist.includes(ip);
}

function bearerMatchesAuthorization(authHeader: string | null | undefined): boolean {
  const raw = authHeader?.trim();
  if (!raw?.startsWith('Bearer ')) return false;
  const token = raw.slice('Bearer '.length).trim();
  if (!token) return false;
  const current = process.env.REVALIDATE_SECRET?.trim();
  const previous = process.env.REVALIDATE_SECRET_PREVIOUS?.trim();
  if (current && token === current) return true;
  if (previous && token === previous) return true;
  return false;
}

/**
 * Revalidación on-demand: `Authorization: Bearer`, secret actual o anterior,
 * allowlist opcional (`REVALIDATE_ALLOWED_IPS`), cuerpo acotado,
 * anti-replay con cabecera `x-hd-nonce` (única por llamada, TTL 60s en memoria).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const allowlist = parseAllowlist(process.env.REVALIDATE_ALLOWED_IPS);
  const clientIp = clientIpFromForwardedFor(req);
  if (!isIpAllowlisted(clientIp, allowlist)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const cl = req.headers.get('content-length');
  if (cl !== null) {
    const n = parseInt(cl, 10);
    if (!Number.isFinite(n) || n < 0 || n > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }
  }

  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const hasSecretConfigured =
    Boolean(process.env.REVALIDATE_SECRET?.trim()) ||
    Boolean(process.env.REVALIDATE_SECRET_PREVIOUS?.trim());
  if (!hasSecretConfigured) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (!bearerMatchesAuthorization(req.headers.get('authorization'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const nonceStatus = tryConsumeNonce(req.headers.get(NONCE_HEADER));
  if (nonceStatus === 'bad') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (nonceStatus === 'replay') {
    return NextResponse.json({ ok: false }, { status: 409 });
  }

  revalidateTag('doctors');
  return NextResponse.json({ revalidated: true, tag: 'doctors' });
}
