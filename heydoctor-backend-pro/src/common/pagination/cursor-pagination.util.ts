import { BadRequestException } from '@nestjs/common';

export type CursorPayload = { t: string; id: string };

/** Cursor opaco para listados DESC por `(createdAt, id)`. */
export function encodeListCursor(createdAt: Date, id: string): string {
  const payload: CursorPayload = { t: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeListCursor(raw: string | undefined): CursorPayload | null {
  if (!raw?.trim()) return null;
  try {
    const json = Buffer.from(raw.trim(), 'base64url').toString('utf8');
    const o = JSON.parse(json) as CursorPayload;
    if (typeof o?.t !== 'string' || typeof o?.id !== 'string') return null;
    const d = new Date(o.t);
    if (Number.isNaN(d.getTime())) return null;
    return o;
  } catch {
    return null;
  }
}

export function assertValidCursor(raw: string | undefined): CursorPayload {
  const c = decodeListCursor(raw);
  if (!c) {
    throw new BadRequestException('Invalid cursor');
  }
  return c;
}
