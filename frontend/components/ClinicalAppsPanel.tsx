'use client';

import React, { useEffect, useState } from 'react';
import { fetchClinicalApps } from '../lib/api-ai';

export interface ClinicalApp {
  name: string;
  description: string;
  routes?: Array<{ path: string; method?: string }>;
  permissions?: string[];
  icon?: string;
  category?: string;
}

interface ClinicalAppsPanelProps {
  clinicId?: number | null;
  className?: string;
  onSelectApp?: (app: ClinicalApp) => void;
}

const iconMap: Record<string, string> = {
  flask: '🧪',
  image: '🖼️',
  pill: '💊',
  heart: '❤️',
  app: '📱',
};

export function ClinicalAppsPanel({
  clinicId,
  className = '',
  onSelectApp,
}: ClinicalAppsPanelProps) {
  const [apps, setApps] = useState<ClinicalApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClinicalApps(clinicId)
      .then((res) => setApps(res?.apps ?? []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [clinicId]);

  if (loading) {
    return (
      <section className={`rounded-lg border border-gray-200 p-4 ${className}`}>
        <h3 className="font-medium text-gray-700 mb-2">Clinical Apps</h3>
        <p className="text-sm text-gray-500">Cargando...</p>
      </section>
    );
  }

  if (apps.length === 0) {
    return (
      <section className={`rounded-lg border border-gray-200 p-4 ${className}`}>
        <h3 className="font-medium text-gray-700 mb-2">Clinical Apps</h3>
        <p className="text-sm text-gray-500">No hay apps disponibles</p>
      </section>
    );
  }

  return (
    <section className={`rounded-lg border border-gray-200 p-4 ${className}`}>
      <h3 className="font-medium text-gray-700 mb-3">Clinical Apps</h3>
      <div className="grid grid-cols-2 gap-2">
        {apps.map((app) => (
          <button
            key={app.name}
            type="button"
            onClick={() => onSelectApp?.(app)}
            className="flex items-start gap-2 p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 text-left transition-colors"
          >
            <span className="text-lg">{iconMap[app.icon ?? 'app'] ?? '📱'}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-800 truncate">
                {app.name === 'lab-orders' && 'Lab Orders'}
                {app.name === 'radiology' && 'Radiology'}
                {app.name === 'pharmacy' && 'Pharmacy'}
                {app.name === 'remote-monitoring' && 'Remote Monitoring'}
                {!['lab-orders', 'radiology', 'pharmacy', 'remote-monitoring'].includes(app.name) &&
                  app.name}
              </p>
              <p className="text-xs text-gray-500 line-clamp-2">{app.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
