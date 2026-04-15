import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Revalidación on-demand (p. ej. webhook desde Railway). Proteger con `REVALIDATE_SECRET`.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const auth = req.headers.get('authorization')?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  revalidateTag('doctors');
  return NextResponse.json({ revalidated: true, tag: 'doctors' });
}
