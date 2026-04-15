import { Injectable } from '@nestjs/common';

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
   * Región efectiva desde cabecera o contexto HTTP (extensible: CDN, subdominio).
   */
  resolveRequestRegion(headerValue?: string | null): string {
    const t = headerValue?.trim();
    return t && t.length > 0 ? t : this.defaultRegion;
  }
}
