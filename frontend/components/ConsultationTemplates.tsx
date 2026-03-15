'use client';

import React, { useEffect, useState } from 'react';
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate, type TemplateData } from '../lib/api-stickiness';

interface Template {
  id: number;
  attributes?: Record<string, unknown>;
  name?: string;
  default_symptoms?: string[];
  recommended_diagnostics?: Array<{ code: string; description?: string }>;
  suggested_treatments?: string[];
  clinical_note_template?: string;
}

interface ConsultationTemplatesProps {
  onSelectTemplate?: (template: Template) => void;
  /** Modo settings: mostrar CRUD completo para /doctor/templates */
  settingsMode?: boolean;
  className?: string;
}

/**
 * Sistema de plantillas de consulta.
 * En settings: CRUD completo. En consulta: selector para autocompletar.
 */
export function ConsultationTemplates({
  onSelectTemplate,
  settingsMode = false,
  className = '',
}: ConsultationTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<Partial<TemplateData>>({
    name: '',
    default_symptoms: [],
    recommended_diagnostics: [],
    suggested_treatments: [],
    clinical_note_template: '',
  });

  const load = () => {
    setLoading(true);
    fetchTemplates()
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const normalize = (t: any): Template => {
    const attrs = t.attributes ?? t;
    return {
      id: t.id,
      attributes: attrs,
      name: attrs.name ?? t.name ?? '',
      default_symptoms: attrs.default_symptoms ?? t.default_symptoms ?? [],
      recommended_diagnostics: attrs.recommended_diagnostics ?? t.recommended_diagnostics ?? [],
      suggested_treatments: attrs.suggested_treatments ?? t.suggested_treatments ?? [],
      clinical_note_template: attrs.clinical_note_template ?? t.clinical_note_template ?? '',
    };
  };

  const toFormData = (t: Template): Partial<TemplateData> => ({
    name: t.name,
    default_symptoms: t.default_symptoms ?? [],
    recommended_diagnostics: t.recommended_diagnostics ?? [],
    suggested_treatments: t.suggested_treatments ?? [],
    clinical_note_template: t.clinical_note_template ?? '',
  });

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    try {
      if (editing) {
        await updateTemplate(editing.id, form as TemplateData);
      } else {
        await createTemplate(form as TemplateData);
      }
      setEditing(null);
      setForm({ name: '', default_symptoms: [], recommended_diagnostics: [], suggested_treatments: [], clinical_note_template: '' });
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar plantilla?')) return;
    try {
      await deleteTemplate(id);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-lg border border-gray-200 p-4 animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
    );
  }

  const list = templates.map(normalize);

  return (
    <div className={`rounded-lg border border-gray-200 p-4 ${className}`}>
      <h3 className="font-medium text-gray-700 mb-3">Plantillas de consulta</h3>

      {settingsMode && (
        <div className="mb-4 p-3 bg-gray-50 rounded space-y-2">
          <input
            type="text"
            value={form.name ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre (ej: Control hipertensión)"
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
          <input
            type="text"
            value={(form.default_symptoms ?? []).join(', ')}
            onChange={(e) => setForm((f) => ({ ...f, default_symptoms: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
            placeholder="Síntomas por defecto (separados por coma)"
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
          <input
            type="text"
            value={(form.suggested_treatments ?? []).join(', ')}
            onChange={(e) => setForm((f) => ({ ...f, suggested_treatments: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
            placeholder="Tratamientos sugeridos (separados por coma)"
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
          <textarea
            value={form.clinical_note_template ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, clinical_note_template: e.target.value }))}
            placeholder="Plantilla de nota clínica..."
            rows={3}
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm">
              {editing ? 'Actualizar' : 'Crear'}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 border rounded text-sm">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {list.map((t) => (
          <li key={t.id} className="flex justify-between items-center p-2 border rounded hover:bg-gray-50">
            <button
              type="button"
              onClick={() => {
                if (settingsMode) {
                  if (editing?.id === t.id) return;
                  setEditing(t);
                  setForm(toFormData(t));
                } else {
                  onSelectTemplate?.(t);
                }
              }}
              className="text-left flex-1"
            >
              <span className="font-medium">{t.name}</span>
              {t.default_symptoms?.length ? (
                <span className="text-xs text-gray-500 ml-2">({t.default_symptoms.length} síntomas)</span>
              ) : null}
            </button>
            {settingsMode && (
              <div className="flex gap-1">
                <button type="button" onClick={() => (setEditing(t), setForm(toFormData(t)))} className="text-indigo-600 text-xs">
                  Editar
                </button>
                <button type="button" onClick={() => handleDelete(t.id)} className="text-red-600 text-xs">
                  Eliminar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-sm text-gray-500">Sin plantillas. Crea una en Configuración del médico.</p>}
    </div>
  );
}
