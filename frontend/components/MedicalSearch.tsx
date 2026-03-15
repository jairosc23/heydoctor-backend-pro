'use client';

import React, { useState, useCallback } from 'react';
import { searchMedical } from '../lib/api-ai';

type SearchType = 'patient' | 'doctor' | 'diagnostic';

interface MedicalSearchProps {
  onSelect?: (item: any, type: SearchType) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Búsqueda médica global.
 * Permite buscar: patients, diagnostics, clinical records (vía API /api/search).
 */
export function MedicalSearch({
  onSelect,
  placeholder = 'Buscar pacientes, diagnósticos...',
  className = '',
}: MedicalSearchProps) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchType>('patient');
  const [results, setResults] = useState<any>({ data: [], meta: {} });
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchMedical(query, type);
      setResults(res);
    } catch {
      setResults({ data: [], meta: {} });
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SearchType)}
          className="px-2 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="patient">Pacientes</option>
          <option value="doctor">Doctores</option>
          <option value="diagnostic">Diagnósticos</option>
        </select>
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50"
        >
          {loading ? '...' : 'Buscar'}
        </button>
      </div>
      {results.data?.length > 0 && (
        <ul className="border border-gray-200 rounded-md divide-y max-h-48 overflow-y-auto">
          {results.data.map((item: any, i: number) => (
            <li
              key={i}
              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect?.(item, type)}
            >
              {type === 'patient' && (item.name ?? `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim())}
              {type === 'doctor' && (item.name ?? `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim())}
              {type === 'diagnostic' && `${item.code ?? ''} - ${item.description ?? ''}`}
            </li>
          ))}
        </ul>
      )}
      {results.meta?.ai_suggestions?.length > 0 && (
        <div className="text-xs text-indigo-600">
          Sugerencias AI: {results.meta.ai_suggestions.join(', ')}
        </div>
      )}
    </div>
  );
}
