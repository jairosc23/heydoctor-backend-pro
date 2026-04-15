import { Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'http';

/** Cabecera HTTP para forzar región de request (edge / cliente). */
export const REGION_REQUEST_HEADER = 'x-region';

/**
 * Punto único para región de negocio y routing futuro (multi-región).
 * `HEYDOCTOR_DEFAULT_REGION` sobreescribe el default (`latam`).
 */
@Injectable()
export class RegionRoutingService {
  readonly defaultRegion: string = (
    process.env.HEYDOCTOR_DEFAULT_REGION?.trim() || 'latam'
  ).toLowerCase();

  /** Valor a persistir en entidades (p. ej. consulta) cuando el cliente no envía región. */
  resolveStoredRegion(explicit?: string | null): string {
    const t = explicit?.trim();
    return t && t.length > 0 ? t : this.defaultRegion;
  }

  /**
   * Región efectiva: prioriza `x-region` (y `X-Region`), luego valor explícito legacy, luego default.
   */
  resolveRequestRegion(
    headers?: IncomingHttpHeaders | null,
    legacyHeaderValue?: string | null,
  ): string {
    const fromHeaders =
      this.pickHeader(headers, REGION_REQUEST_HEADER) ??
      this.pickHeader(headers, 'X-Region');
    if (fromHeaders) {
      return fromHeaders.toLowerCase();
    }
    const t = legacyHeaderValue?.trim();
    return t && t.length > 0 ? t : this.defaultRegion;
  }

  private pickHeader(
    headers: IncomingHttpHeaders | null | undefined,
    name: string,
  ): string | undefined {
    if (!headers) return undefined;
    const key = name.toLowerCase();
    const raw = headers[key] ?? headers[name];
    if (typeof raw === 'string') {
      const v = raw.trim();
      return v.length > 0 ? v : undefined;
    }
    if (Array.isArray(raw)) {
      const first = raw[0];
      if (typeof first === 'string') {
        const v = first.trim();
        return v.length > 0 ? v : undefined;
      }
    }
    return undefined;
  }
}
