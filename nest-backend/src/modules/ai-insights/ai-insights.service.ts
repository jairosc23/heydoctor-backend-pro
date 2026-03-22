import { createHash } from 'crypto';
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiInsight,
  Consultation,
  ClinicalRecord,
  LabOrder,
  Prescription,
} from '../../entities';
import { OpenAIService } from '../../common/services/openai.service';
import {
  PredictedCondition,
  RiskScore,
  ClinicalPattern,
  RecommendedAction,
} from '../../entities/ai-insight.entity';
import { GenerateInsightsDto } from './dto/generate-insights.dto';
import { requireClinicId } from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';
import { CLINICAL_AI_DISCLAIMER } from '../../common/constants/clinical-ai-disclaimer';

interface AiInsightsResponse {
  predicted_conditions: PredictedCondition[];
  risk_scores: RiskScore[];
  clinical_patterns: ClinicalPattern[];
  recommended_actions: RecommendedAction[];
}

@Injectable()
export class AiInsightsService {
  constructor(
    @InjectRepository(AiInsight)
    private readonly aiInsightRepo: Repository<AiInsight>,
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
    @InjectRepository(ClinicalRecord)
    private readonly clinicalRecordRepo: Repository<ClinicalRecord>,
    @InjectRepository(LabOrder)
    private readonly labOrderRepo: Repository<LabOrder>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    private readonly openai: OpenAIService,
    private readonly authz: AuthorizationService,
  ) {}

  async getByPatient(
    patientId: string,
    clinicId: string | undefined | null,
    limit: number,
    actor: AuthActor,
  ): Promise<{ data: AiInsight[]; disclaimer: string }> {
    const cid = requireClinicId(clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);
    await this.authz.assertPatientInClinic(patientId, cid);

    const qb = this.aiInsightRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.consultation', 'consultation')
      .where('a.patientId = :patientId', { patientId })
      .andWhere('a.clinicId = :clinicId', { clinicId: cid })
      .orderBy('a.createdAt', 'DESC')
      .take(limit);

    const items = await qb.getMany();
    return { data: items, disclaimer: CLINICAL_AI_DISCLAIMER };
  }

  async generate(
    dto: GenerateInsightsDto,
    clinicId: string | undefined | null,
    actor: AuthActor,
  ): Promise<{ data: AiInsight; disclaimer: string }> {
    const cid = requireClinicId(clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);
    await this.authz.assertPatientInClinic(dto.patientId, cid);

    if (dto.consultationId) {
      const consultation = await this.consultationRepo.findOne({
        where: { id: dto.consultationId },
      });
      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }
      await this.authz.assertOwnership(
        { type: 'consultation', entity: consultation },
        actor,
      );
    }

    const clinicalContext = await this.buildClinicalContext(
      dto.patientId,
      dto.consultationId,
      cid,
    );

    const symptomsInput =
      (dto.symptoms ??
        (Array.isArray(dto.symptomsList) ? dto.symptomsList.join(', ') : '')) ||
      clinicalContext.symptomsSummary ||
      'No symptoms provided';

    const fullContext = [
      clinicalContext.recordsSummary,
      clinicalContext.labSummary,
      clinicalContext.prescriptionsSummary,
      clinicalContext.diagnosesSummary,
      dto.context,
    ]
      .filter(Boolean)
      .join('\n\n');

    let result: AiInsightsResponse = {
      predicted_conditions: [],
      risk_scores: [],
      clinical_patterns: [],
      recommended_actions: [],
    };

    let aiModel: string | null = null;
    let aiTemperature: number | null = null;
    let promptHash: string | null = null;

    if (this.openai.isAvailable) {
      try {
        const systemPrompt = `You are a clinical intelligence assistant for doctors. Analyze the patient data and return ONLY a valid JSON object with these exact keys (no markdown, no extra text):
- predicted_conditions: array of { condition: string, code?: string, probability?: number (0-1), timeframe?: string }
- risk_scores: array of { condition: string, score: number (0-100), level: "low"|"medium"|"high", factors?: string[] }
- clinical_patterns: array of { pattern: string, description?: string, relevance?: string, evidence?: string[] }
- recommended_actions: array of { action: string, priority?: "low"|"medium"|"high"|"urgent", category?: string, rationale?: string }

Do not include patient names, dates of birth, national IDs, emails, or phone numbers. Use only clinical descriptors and structured context.

Be concise. Use ICD-10 codes when possible for conditions. Prioritize actionable insights.`;

        const userPrompt = `Symptoms/Chief complaint: ${symptomsInput}

Structured clinical context (anonymized clinic-scoped summaries only):
${fullContext || 'No additional context.'}

Return the JSON with clinical insights.`;

        promptHash = createHash('sha256')
          .update(`${systemPrompt}\n${userPrompt}`, 'utf8')
          .digest('hex');

        const { text, model, temperature } =
          await this.openai.completeWithTelemetry(userPrompt, systemPrompt);
        aiModel = model;
        aiTemperature = temperature;
        const parsed = this.openai.parseJsonResponse<AiInsightsResponse>(text);
        if (parsed) {
          result = {
            predicted_conditions: Array.isArray(parsed.predicted_conditions)
              ? parsed.predicted_conditions
              : [],
            risk_scores: Array.isArray(parsed.risk_scores)
              ? parsed.risk_scores
              : [],
            clinical_patterns: Array.isArray(parsed.clinical_patterns)
              ? parsed.clinical_patterns
              : [],
            recommended_actions: Array.isArray(parsed.recommended_actions)
              ? parsed.recommended_actions
              : [],
          };
        }
      } catch {
        // Fallback to empty - AI unavailable or failed
      }
    }

    const insight = this.aiInsightRepo.create({
      patientId: dto.patientId,
      consultationId: dto.consultationId ?? null,
      clinicId: cid,
      predicted_conditions: result.predicted_conditions,
      risk_scores: result.risk_scores,
      clinical_patterns: result.clinical_patterns,
      recommended_actions: result.recommended_actions,
      ai_model: aiModel,
      ai_temperature: aiTemperature,
      prompt_hash: promptHash,
    });

    const saved = await this.aiInsightRepo.save(insight);
    return { data: saved, disclaimer: CLINICAL_AI_DISCLAIMER };
  }

  private async buildClinicalContext(
    patientId: string,
    consultationId: string | undefined,
    clinicId: string,
  ): Promise<{
    symptomsSummary: string;
    recordsSummary: string;
    labSummary: string;
    prescriptionsSummary: string;
    diagnosesSummary: string;
  }> {
    const recordWhere = { patientId, clinicId };
    const labWhere = { patientId, clinicId };
    const rxWhere = { patientId, clinicId };

    const [records, labOrders, prescriptions, consultation] = await Promise.all(
      [
        this.clinicalRecordRepo.find({
          where: recordWhere,
          relations: ['diagnostics'],
          order: { consultationDate: 'DESC' },
          take: 5,
        }),
        this.labOrderRepo.find({
          where: labWhere,
          order: { createdAt: 'DESC' },
          take: 5,
        }),
        this.prescriptionRepo.find({
          where: rxWhere,
          order: { createdAt: 'DESC' },
          take: 5,
        }),
        consultationId
          ? this.consultationRepo.findOne({
              where: { id: consultationId, clinicId },
              relations: ['diagnostic'],
            })
          : null,
      ],
    );

    if (consultationId && !consultation) {
      throw new NotFoundException('Consultation not found');
    }

    const symptomsFromRecords = records
      .map((r) => r.chiefComplaint || r.clinicalNote)
      .filter(Boolean)
      .join('; ');
    const symptomsFromConsultation =
      consultation?.appointment_reason ?? consultation?.notes ?? '';

    const diagnosesFromRecords = records.flatMap((r) =>
      (r.diagnostics || []).map((d) => d.diagnosis_details ?? ''),
    );
    const diagnosesFromConsultation = consultation?.diagnostic
      ? [consultation.diagnostic.diagnosis_details ?? '']
      : [];

    return {
      symptomsSummary:
        [symptomsFromRecords, symptomsFromConsultation]
          .filter(Boolean)
          .join('. ') || 'Not documented',
      recordsSummary: records.length
        ? `Recent records: ${records.length} clinical records. ${symptomsFromRecords || ''}`
        : '',
      labSummary: labOrders.length
        ? `Recent lab orders: ${labOrders.map((l) => l.lab_tests?.join(', ') || 'tests').join('; ')}`
        : '',
      prescriptionsSummary: prescriptions.length
        ? `Recent prescriptions: ${prescriptions.map((p) => p.medications?.map((m) => m.name).join(', ') || 'meds').join('; ')}`
        : '',
      diagnosesSummary: [...diagnosesFromRecords, ...diagnosesFromConsultation]
        .filter(Boolean).length
        ? `Prior diagnoses: ${[...new Set([...diagnosesFromRecords, ...diagnosesFromConsultation].filter(Boolean))].join(', ')}`
        : '',
    };
  }
}
