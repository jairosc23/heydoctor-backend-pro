'use client';

import React from 'react';
import type { ConnectionQuality } from '../lib/webrtc-connection-quality';

const LABELS: Record<Exclude<ConnectionQuality, null>, string> = {
  good: 'Conexión buena',
  weak: 'Conexión débil',
  poor: 'Conexión mala',
  reconnecting: 'Reconectando…',
};

const STYLES: Record<Exclude<ConnectionQuality, null>, React.CSSProperties> = {
  good: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    color: '#15803d',
    border: '1px solid rgba(22, 163, 74, 0.35)',
  },
  weak: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    color: '#a16207',
    border: '1px solid rgba(234, 179, 8, 0.4)',
  },
  poor: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    color: '#b91c1c',
    border: '1px solid rgba(220, 38, 38, 0.35)',
  },
  reconnecting: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#1d4ed8',
    border: '1px solid rgba(59, 130, 246, 0.35)',
  },
};

export type ConnectionQualityBadgeProps = {
  quality: ConnectionQuality | null;
  className?: string;
  /** Sin llamada activa no se muestra nada */
  showWhenIdle?: boolean;
};

/**
 * Indicador ligero de calidad (RTT, pérdida, ICE) para videollamadas.
 * Los valores vienen de `useTelemedicineCall().connectionQuality`.
 */
export function ConnectionQualityBadge({
  quality,
  className = '',
  showWhenIdle = false,
}: ConnectionQualityBadgeProps) {
  if (quality === null && !showWhenIdle) {
    return null;
  }

  const idleStyle: React.CSSProperties = {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    color: '#475569',
    border: '1px solid rgba(100, 116, 139, 0.3)',
  };

  const styleBlock =
    quality === null ? idleStyle : STYLES[quality];

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.2,
    ...styleBlock,
  };

  return (
    <span
      className={className}
      style={base}
      role="status"
      aria-live="polite"
    >
      {quality === null ? 'Sin sesión' : LABELS[quality]}
    </span>
  );
}
