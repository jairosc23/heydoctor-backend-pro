import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const MAX_BODY_BYTES = 2048;

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
 * allowlist opcional (`REVALIDATE_ALLOWED_IPS`, IPs en x-forwarded-for),
 * cuerpo acotado.
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

  revalidateTag('doctors');
  return NextResponse.json({ revalidated: true, tag: 'doctors' });
}
