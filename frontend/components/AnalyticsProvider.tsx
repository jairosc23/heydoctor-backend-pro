'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useRef } from 'react';
import { trackPageView } from '../lib/analytics';

export type AnalyticsProviderProps = {
  children: React.ReactNode;
};

function AnalyticsRouteTracker({ children }: AnalyticsProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const qs = searchParams?.toString();
    const path = `${pathname ?? '/'}${qs ? `?${qs}` : ''}`;
    if (lastSent.current === path) return;
    lastSent.current = path;
    void trackPageView(path);
  }, [pathname, searchParams]);

  return <>{children}</>;
}

/**
 * Montar en el layout raíz de la app Next (App Router).
 * Envía `page_view` en cada cambio de ruta (pathname + query).
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  return (
    <Suspense fallback={<>{children}</>}>
      <AnalyticsRouteTracker>{children}</AnalyticsRouteTracker>
    </Suspense>
  );
}
