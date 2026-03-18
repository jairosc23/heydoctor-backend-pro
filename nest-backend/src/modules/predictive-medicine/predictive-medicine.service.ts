import { Injectable } from '@nestjs/common';
import { OpenAIService } from '../../common/services/openai.service';

export interface PredictiveRiskInput {
  symptoms?: string[];
  context?: Record<string, unknown>;
}

export interface PredictiveRiskResponse {
  predicted_conditions: Array<{
    condition: string;
    probability: number;
    timeframe?: string;
  }>;
  risk_scores: Array<{
    condition: string;
    score: number;
    level: string;
  }>;
  preventive_actions: string[];
}

@Injectable()
export class PredictiveMedicineService {
  constructor(private readonly openai: OpenAIService) {}

  async assessRisk(data: PredictiveRiskInput): Promise<PredictiveRiskResponse> {
    const emptyResponse: PredictiveRiskResponse = {
      predicted_conditions: [],
      risk_scores: [],
      preventive_actions: [],
    };

    if (!this.openai.isAvailable) {
      return emptyResponse;
    }

    try {
      const symptomsStr = (data.symptoms || []).join(', ') || 'No especificados';
      const contextStr = JSON.stringify(data.context || {});

      const systemPrompt = `Eres un sistema de medicina predictiva. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown.
El JSON debe tener exactamente estas claves:
- predicted_conditions: array de objetos { condition, probability (0-1), timeframe opcional }
- risk_scores: array de objetos { condition, score (0-100), level: "low"|"medium"|"high" }
- preventive_actions: array de strings (acciones preventivas recomendadas)`;

      const userPrompt = `Evalúa el riesgo predictivo basado en:

Síntomas: ${symptomsStr}
Contexto: ${contextStr}

Devuelve el JSON solicitado.`;

      const response = await this.openai.complete(userPrompt, systemPrompt);
      const parsed = this.openai.parseJsonResponse<PredictiveRiskResponse>(response);

      if (parsed) {
        return {
          predicted_conditions: Array.isArray(parsed.predicted_conditions)
            ? parsed.predicted_conditions
            : emptyResponse.predicted_conditions,
          risk_scores: Array.isArray(parsed.risk_scores)
            ? parsed.risk_scores
            : emptyResponse.risk_scores,
          preventive_actions: Array.isArray(parsed.preventive_actions)
            ? parsed.preventive_actions
            : emptyResponse.preventive_actions,
        };
      }
      return emptyResponse;
    } catch {
      return emptyResponse;
    }
  }
}
