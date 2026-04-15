import {
  ConflictException,
  Injectable,
  type LoggerService,
} from '@nestjs/common';
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
    const fromHeaders = this.getRawRegionHeader(headers);
    if (fromHeaders) {
      return fromHeaders.toLowerCase();
    }
    const t = legacyHeaderValue?.trim();
    return t && t.length > 0 ? t : this.defaultRegion;
  }

  /** Valor crudo de cabecera (sin default). */
  getRawRegionHeader(
    headers?: IncomingHttpHeaders | null,
  ): string | undefined {
    const v =
      this.pickHeader(headers, REGION_REQUEST_HEADER) ??
      this.pickHeader(headers, 'X-Region');
    return v?.trim() || undefined;
  }

  /**
   * Consistencia clínica: si el cliente fija `x-region` y no coincide con la entidad,
   * en lectura se registra warning; en escritura, 409.
   */
  /** Alta: región persistida debe alinear con `x-region` si el cliente la envía. */
  assertCreateRegionMatchesRequest(
    explicitHeader: boolean,
    dtoRegion: string | undefined,
    resolvedRequestRegion: string,
  ): void {
    if (!explicitHeader) return;
    const stored = this.resolveStoredRegion(dtoRegion);
    const reqR = resolvedRequestRegion.trim().toLowerCase();
    if (stored !== reqR) {
      throw new ConflictException(
        `Create region "${stored}" does not match x-region "${reqR}"`,
      );
    }
  }

  assertEntityRegionConsistency(
    operation: 'read' | 'write',
    storedRegion: string | null | undefined,
    requestResolvedRegion: string,
    explicitHeader: boolean,
    log: LoggerService,
  ): void {
    if (!explicitHeader) return;
    const stored = (storedRegion ?? '').trim().toLowerCase();
    const entityRegion = stored.length > 0 ? stored : this.defaultRegion;
    const reqR = requestResolvedRegion.trim().toLowerCase();
    if (entityRegion === reqR) return;
    if (operation === 'write') {
      throw new ConflictException(
        `Region mismatch: resource is pinned to "${entityRegion}", request is "${reqR}"`,
      );
    }
    log.warn(
      JSON.stringify({
        msg: 'region_consistency_warning',
        entityRegion,
        requestRegion: reqR,
      }),
    );
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
