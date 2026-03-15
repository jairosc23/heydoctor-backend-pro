'use client';

import React, { useEffect, useState } from 'react';
import { fetchTemplates } from '../lib/api-stickiness';

interface Template {
  id: number;
  name?: string;
  default_symptoms?: string[];
  recommended_diagnostics?: Array<{ code: string; description?: string }>;
  suggested_treatments?: string[];
  clinical_note_template?: string;
}

interface TemplateSelectorProps {
  onSelect?: (template: Template) => void;
  className?: string;
}

/**
 * Selector de plantilla para la consulta.
 * Al seleccionar, autocompleta síntomas, diagnósticos, tratamientos y nota clínica.
 */
export function TemplateSelector({ onSelect, className = '' }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchTemplates()
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const normalize = (t: any): Template => {
    const attrs = t.attributes ?? t;
    return {
      id: t.id,
      name: attrs.name ?? t.name,
      default_symptoms: attrs.default_symptoms ?? t.default_symptoms ?? [],
      recommended_diagnostics: attrs.recommended_diagnostics ?? t.recommended_diagnostics ?? [],
      suggested_treatments: attrs.suggested_treatments ?? t.suggested_treatments ?? [],
      clinical_note_template: attrs.clinical_note_template ?? t.clinical_note_template ?? '',
    };
  };

  const list = templates.map(normalize);
  if (list.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700"
      >
        Usar plantilla
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect?.(normalize(t));
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
