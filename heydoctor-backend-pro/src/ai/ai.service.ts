import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ENV_CONFIG_TOKEN, type EnvConfig } from '../config/env.config';
import type { ConsultationAssistDto } from './dto/consultation-assist.dto';
import type { GenerateAiDto } from './dto/generate-ai.dto';
import type { ClinicalSummaryResult, ConsultationAssistResult } from './ai.types';

@Injectable()
export class AiService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(ENV_CONFIG_TOKEN)
    private readonly env: EnvConfig,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.client = new OpenAI({
      apiKey: apiKey || 'sk-not-configured',
    });
  }

  /**
   * Calls OpenAI once; returns parsed JSON only (no DB writes).
   */
  async generateClinicalSummary(dto: GenerateAiDto): Promise<ClinicalSummaryResult> {
    const model =
      this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
    const userBlock = this.buildUserContent(dto);

    let raw: string;
    try {
      const completion = await this.client.chat.completions.create({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userBlock },
        ],
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new BadGatewayException('Empty response from language model');
      }
      raw = content;
    } catch (err) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      throw new BadGatewayException('Clinical assistant temporarily unavailable');
    }

    const parsed = this.parseClinicalJson(raw);
    if (!this.env.isProduction && !this.env.hipaaMode) {
      this.logger.debug(
        `consultation-summary ok model=${model} responseChars=${raw.length}`,
      );
    }
    return parsed;
  }

  private buildUserContent(dto: GenerateAiDto): string {
    const lines: string[] = [
      'Use only the following clinical fields (may be empty).',
      '',
    ];

    const age = dto.patientAge?.trim();
    const sex = dto.patientSex?.trim();
    if (age || sex) {
      lines.push('Patient demographics (optional; verify at point of care):');
      lines.push(`Age: ${age || 'not provided'}`);
      lines.push(`Sex / gender: ${sex || 'not provided'}`);
      lines.push('');
    }

    const prior = dto.priorNotesExcerpt?.trim();
    if (prior) {
      lines.push(
        'Recent documentation tail (last up to 300 characters; may overlap full notes):',
      );
      lines.push(prior);
      lines.push('');
    }

    const sx = dto.symptoms?.trim();
    if (sx) {
      lines.push(`Symptoms / síntomas:\n${sx}`, '');
    }

    lines.push(
      `Chief complaint / motivo de consulta:\n${dto.chiefComplaint || '(none)'}`,
      '',
      `Evolution / clinical notes:\n${dto.notes || '(none)'}`,
      '',
      `Working diagnosis (clinician-entered, not verified by AI):\n${dto.diagnosis || '(none)'}`,
      '',
      `Treatment plan:\n${dto.treatmentPlan || '(none)'}`,
    );

    return lines.join('\n');
  }

  private parseClinicalJson(raw: string): ClinicalSummaryResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new BadGatewayException('Model returned non-JSON output');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException('Invalid AI response shape');
    }

    const o = parsed as Record<string, unknown>;
    const summary = o.summary;
    const suggestedDiagnosis = o.suggestedDiagnosis;
    const improvedNotes = o.improvedNotes;

    if (typeof summary !== 'string' || typeof improvedNotes !== 'string') {
      throw new BadGatewayException('Invalid AI response shape');
    }

    let diagnoses: string[];
    if (Array.isArray(suggestedDiagnosis)) {
      diagnoses = suggestedDiagnosis.filter((x): x is string => typeof x === 'string');
    } else if (typeof suggestedDiagnosis === 'string') {
      diagnoses = [suggestedDiagnosis];
    } else {
      diagnoses = [];
    }

    return { summary, suggestedDiagnosis: diagnoses, improvedNotes };
  }

  /**
   * Assistive suggestions only — no treatment decisions or definitive diagnoses.
   */
  async generateConsultationAssist(
    dto: ConsultationAssistDto,
  ): Promise<ConsultationAssistResult> {
    const chief = dto.chiefComplaint?.trim() ?? '';
    const sx = dto.symptoms?.trim() ?? '';
    const notes = dto.notes?.trim() ?? '';
    if (!chief && !sx && !notes) {
      throw new BadRequestException(
        'Provide at least one of chiefComplaint, symptoms, or notes',
      );
    }

    const model =
      this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
    const userBlock = [
      'Chief complaint:',
      chief || '(none)',
      '',
      'Symptoms:',
      sx || '(none)',
      '',
      'Notes:',
      notes || '(none)',
    ].join('\n');

    let raw: string;
    try {
      const completion = await this.client.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CONSULTATION_ASSIST_SYSTEM_PROMPT },
          { role: 'user', content: userBlock },
        ],
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new BadGatewayException('Empty response from language model');
      }
      raw = content;
    } catch (err) {
      if (
        err instanceof BadGatewayException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      throw new BadGatewayException(
        'Consultation assist temporarily unavailable',
      );
    }

    const parsed = this.parseConsultationAssistJson(raw);
    if (!this.env.isProduction && !this.env.hipaaMode) {
      this.logger.debug(
        `consultation-assist ok model=${model} responseChars=${raw.length}`,
      );
    }
    return parsed;
  }

  private parseConsultationAssistJson(raw: string): ConsultationAssistResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new BadGatewayException('Model returned non-JSON output');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException('Invalid AI response shape');
    }

    const o = parsed as Record<string, unknown>;
    const assistiveOnlyNotice = o.assistiveOnlyNotice;
    const possibleDiagnoses = o.possibleDiagnoses;
    const recommendations = o.recommendations;
    const generalEducation = o.generalEducation;

    if (typeof assistiveOnlyNotice !== 'string') {
      throw new BadGatewayException('Invalid AI response shape');
    }

    const toStrArr = (v: unknown, key: string): string[] => {
      if (!Array.isArray(v)) {
        throw new BadGatewayException(`Invalid AI response: ${key}`);
      }
      return v.filter((x): x is string => typeof x === 'string');
    };

    return {
      assistiveOnlyNotice,
      possibleDiagnoses: toStrArr(possibleDiagnoses, 'possibleDiagnoses'),
      recommendations: toStrArr(recommendations, 'recommendations'),
      generalEducation: toStrArr(generalEducation, 'generalEducation'),
    };
  }
}

const SYSTEM_PROMPT = `You are a clinical documentation assistant for licensed healthcare professionals. You are not a substitute for clinical judgment, examination, or diagnostic testing.

Rules:
- Output MUST be a single JSON object with exactly these keys: "summary" (string), "suggestedDiagnosis" (array of strings), "improvedNotes" (string). No markdown fences, no extra keys.
- "summary": concise professional narrative of the consultation context (chief complaint, relevant documented findings if any, and plan direction). Use neutral clinical language.
- "suggestedDiagnosis": 2–6 differential diagnoses or working hypotheses that could be considered in a clinical setting, ordered from more to less likely given ONLY the text provided. Each item must be phrased as a possibility (e.g. "Possible …", "Consider …", "Differential includes …"). Never state a definitive or certain diagnosis. If information is insufficient, return fewer items or a single item stating that further assessment is needed.
- "improvedNotes": polished clinical note text that preserves meaning, improves clarity and standard medical wording, and avoids claiming findings not present in the input. If input is empty, return a brief note that documentation is pending.

Safety:
- Do not invent patient demographics, vitals, labs, imaging, or exam findings not present in the input.
- Include a brief reminder in "summary" or "improvedNotes" that suggestions are non-binding and require clinician verification when appropriate.
- Use professional tone; no alarmist language.`;

const CONSULTATION_ASSIST_SYSTEM_PROMPT = `You support licensed clinicians with NON-BINDING educational and pattern-recognition hints only. You never make autonomous clinical decisions.

Rules:
- Output MUST be a single JSON object with exactly these keys:
  "assistiveOnlyNotice" (string),
  "possibleDiagnoses" (array of strings),
  "recommendations" (array of strings),
  "generalEducation" (array of strings).
- "assistiveOnlyNotice": must state clearly that output is assistive, not a diagnosis, requires clinician verification, and must not replace examination or tests.
- "possibleDiagnoses": 2–8 differentials phrased as possibilities only (e.g. "Consider …", "Possible …"). Never state certainty. If data is sparse, say so and list broader categories.
- "recommendations": only high-level next-step categories a clinician might weigh (e.g. "correlate with vitals", "consider appropriate testing per guidelines") — no drug names, doses, or direct orders.
- "generalEducation": brief, neutral patient-appropriate educational bullets that a clinician may use if they choose (no alarming language).

Safety:
- Do not invent vitals, labs, history, or exam findings not in the input.
- No prescription or treatment protocols. No definitive diagnosis.`;
