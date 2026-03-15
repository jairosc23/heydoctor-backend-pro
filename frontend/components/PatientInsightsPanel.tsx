'use client';

import React, { useEffect, useState } from 'react';
import { fetchClinicalSuggestions, fetchPredictiveRisk } from '../lib/api-ai';
import { PredictiveInsightsPanel } from './PredictiveInsightsPanel';

interface PatientInsightsPanelProps {
  /** Síntomas o motivo de consulta del paciente (desde admission_reason, etc.) */
  symptoms: string[];
  clinicId?: number | null;
  className?: string;
}

/**
 * Panel lateral para la página de perfil del paciente.
 * Muestra: Predictive risk scores, Clinical Intelligence insights.
 * Datos de: GET /api/clinical-intelligence/suggest
 */
export function PatientInsightsPanel({
  symptoms,
  clinicId,
  className = '',
}: PatientInsightsPanelProps) {
  const [ciData, setCiData] = useState<any>(null);
  const [predictiveData, setPredictiveData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const symptomText = Array.isArray(symptoms) ? symptoms.join(' ') : String(symptoms || '');
  const symptomArr = symptomText ? symptomText.split(/\s+/).filter(Boolean) : [];

  useEffect(() => {
    if (!symptomText.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetchClinicalSuggestions(symptomText),
      fetchPredictiveRisk(symptomArr, { clinic_id: clinicId ?? undefined }),
    ])
      .then(([ci, pred]) => {
        setCiData(ci);
        setPredictiveData(pred);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symptomText, clinicId]);

  if (!symptomText.trim()) return null;

  return (
    <aside className={`w-72 flex-shrink-0 space-y-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700">Insights clínicos</h3>
      {loading ? (
        <div className="p-4 rounded-lg bg-gray-50 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      ) : (
        <>
          {ciData && (
            <div className="rounded-lg border border-gray-200 p-3">
              <h4 className="font-medium text-gray-700 mb-2 text-sm">Clinical Intelligence</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {(ciData.suggested_diagnoses ?? []).slice(0, 5).map((d: any, i: number) => (
                  <li key={i}>{d.description || d.code} {d.frequency ? `(${d.frequency})` : ''}</li>
                ))}
              </ul>
            </div>
          )}
          <PredictiveInsightsPanel
            predicted_conditions={predictiveData?.predicted_conditions}
            risk_scores={predictiveData?.risk_scores}
            preventive_actions={predictiveData?.preventive_actions}
          />
        </>
      )}
    </aside>
  );
}
