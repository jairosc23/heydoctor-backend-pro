import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../../common/services/openai.service';

export interface CdssEvaluateInput {
  symptoms?: string[];
  context?: Record<string, unknown>;
}

export interface CdssEvaluateResponse {
  alerts: string[];
  suggested_diagnoses: Array<{ code?: string; description: string; likelihood?: string }>;
  treatment_recommendations: string[];
  preventive_actions: string[];
  risk_levels: Array<{ condition: string; level: string }>;
}

@Injectable()
export class CdssService {
  constructor(private readonly openai: OpenAIService) {}

  async evaluate(data: CdssEvaluateInput): Promise<CdssEvaluateResponse> {
    const emptyResponse: CdssEvaluateResponse = {
      alerts: [],
      suggested_diagnoses: [],
      treatment_recommendations: [],
      preventive_actions: [],
      risk_levels: [],
    };

    if (!this.openai.isAvailable) {
      return emptyResponse;
    }

    try {
      const symptomsStr = (data.symptoms || []).join(', ') || 'No especificados';
      const contextStr = JSON.stringify(data.context || {});

      const systemPrompt = `Eres un Sistema de Soporte de Decisiones Clínicas (CDSS). Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown.
El JSON debe tener exactamente estas claves:
- alerts: array de strings (alertas clínicas relevantes)
- suggested_diagnoses: array de objetos { code, description, likelihood } (diagnósticos sugeridos con código CIE-10 si aplica)
- treatment_recommendations: array de strings (recomendaciones de tratamiento)
- preventive_actions: array de strings (acciones preventivas)
- risk_levels: array de objetos { condition, level } (niveles de riesgo: low, medium, high)`;

      const userPrompt = `Analiza la siguiente información clínica y devuelve el JSON solicitado:

Síntomas: ${symptomsStr}
Contexto adicional: ${contextStr}

Responde solo con el objeto JSON.`;

      const response = await this.openai.complete(userPrompt, systemPrompt);
      const parsed = this.openai.parseJsonResponse<CdssEvaluateResponse>(response);

      if (parsed) {
        return {
          alerts: Array.isArray(parsed.alerts) ? parsed.alerts : emptyResponse.alerts,
          suggested_diagnoses: Array.isArray(parsed.suggested_diagnoses)
            ? parsed.suggested_diagnoses
            : emptyResponse.suggested_diagnoses,
          treatment_recommendations: Array.isArray(parsed.treatment_recommendations)
            ? parsed.treatment_recommendations
            : emptyResponse.treatment_recommendations,
          preventive_actions: Array.isArray(parsed.preventive_actions)
            ? parsed.preventive_actions
            : emptyResponse.preventive_actions,
          risk_levels: Array.isArray(parsed.risk_levels)
            ? parsed.risk_levels
            : emptyResponse.risk_levels,
        };
      }
      return emptyResponse;
    } catch {
      return emptyResponse;
    }
  }
}
