import type { ConfigService } from '@nestjs/config';

export const DEFAULT_TURN_REGIONAL_HOSTS = [
  'turn-scl.heydoctor.health',
  'turn-gru.heydoctor.health',
  'turn-bog.heydoctor.health',
] as const;

/** Public hostnames for TURN probes and ICE construction (same env as WebrtcTurnService). */
export function resolveTurnRegionalHosts(config: ConfigService): string[] {
  const raw = config.get<string>('TURN_REGIONAL_HOSTS')?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_TURN_REGIONAL_HOSTS];
}

export function inferRegionLabelFromHost(host: string): string {
  if (host.includes('turn-scl')) return 'scl';
  if (host.includes('turn-gru')) return 'gru';
  if (host.includes('turn-bog')) return 'bog';
  if (host.includes('heydoctor')) return 'legacy';
  return 'unknown';
}
