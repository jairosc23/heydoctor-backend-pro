import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation } from '../../entities';
import { OpenAIService } from '../../common/services/openai.service';
import { requireClinicId } from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';
import { sanitizeFreeTextForAi } from '../../common/utils/sanitize-ai-context.util';

export interface CopilotSuggestionsResponse {
  symptoms_detected: string[];
  possible_diagnoses: Array<{ code?: string; name: string; likelihood?: string }>;
  suggested_diagnoses: Array<{ code?: string; description: string }>;
  suggested_questions: string[];
  suggested_tests: string[];
  suggested_treatments: string[];
}

export interface GenerateNoteInput {
  consultationId?: string;
  symptoms?: string[];
  clinical_notes?: string;
  patient_history?: string;
  messages?: Array<{ role: string; content: string }>;
}

export interface ClinicalNoteResponse {
  chief_complaint: string;
  history_of_present_illness: string;
  assessment: string;
  plan: string;
}

@Injectable()
export class CopilotService {
  constructor(
    private readonly openai: OpenAIService,
    private readonly authz: AuthorizationService,
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
  ) {}

  async getSuggestions(
    consultationId: string,
    actor: AuthActor,
  ): Promise<{ data: CopilotSuggestionsResponse }> {
    const cid = requireClinicId(actor.clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);

    const emptyData: CopilotSuggestionsResponse = {
      symptoms_detected: [],
      possible_diagnoses: [],
      suggested_diagnoses: [],
      suggested_questions: [],
      suggested_tests: [],
      suggested_treatments: [],
    };

    if (!this.openai.isAvailable) {
      return { data: emptyData };
    }

    let anonymizedContext = '';
    if (consultationId?.trim()) {
      const consultation = await this.consultationRepo.findOne({
        where: { id: consultationId.trim() },
      });
      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }
      await this.authz.assertOwnership(
        { type: 'consultation', entity: consultation },
        actor,
      );
      anonymizedContext = sanitizeFreeTextForAi(
        [consultation.appointment_reason, consultation.notes]
          .filter(Boolean)
          .join('\n'),
        6000,
      );
    }

    try {
      const systemPrompt = `Eres un asistente clínico. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown.
El JSON debe tener exactamente estas claves:
- symptoms_detected: array de strings (síntomas detectados o inferidos)
- possible_diagnoses: array de objetos { code, name, likelihood }
- suggested_diagnoses: array de objetos { code, description }
- suggested_questions: array de strings (preguntas sugeridas para la anamnesis)
- suggested_tests: array de strings (estudios o exámenes sugeridos)
- suggested_treatments: array de strings (tratamientos sugeridos)
No incluyas nombres de pacientes, fechas de nacimiento ni identificadores.`;

      const userPrompt = `Contexto clínico libre de texto (sin identificadores):
${anonymizedContext || 'No hay contexto adicional; usa buenas prácticas generales.'}

Genera sugerencias clínicas completas. Devuelve el JSON con las 6 claves solicitadas.`;

      const response = await this.openai.complete(userPrompt, systemPrompt);
      const parsed = this.openai.parseJsonResponse<CopilotSuggestionsResponse>(response);

      if (parsed) {
        return {
          data: {
            symptoms_detected: Array.isArray(parsed.symptoms_detected)
              ? parsed.symptoms_detected
              : emptyData.symptoms_detected,
            possible_diagnoses: Array.isArray(parsed.possible_diagnoses)
              ? parsed.possible_diagnoses
              : emptyData.possible_diagnoses,
            suggested_diagnoses: Array.isArray(parsed.suggested_diagnoses)
              ? parsed.suggested_diagnoses
              : emptyData.suggested_diagnoses,
            suggested_questions: Array.isArray(parsed.suggested_questions)
              ? parsed.suggested_questions
              : emptyData.suggested_questions,
            suggested_tests: Array.isArray(parsed.suggested_tests)
              ? parsed.suggested_tests
              : emptyData.suggested_tests,
            suggested_treatments: Array.isArray(parsed.suggested_treatments)
              ? parsed.suggested_treatments
              : emptyData.suggested_treatments,
          },
        };
      }
      return { data: emptyData };
    } catch {
      return { data: emptyData };
    }
  }

  async generateClinicalNote(
    consultationData: GenerateNoteInput,
    actor: AuthActor,
  ): Promise<{ data: ClinicalNoteResponse }> {
    const cid = requireClinicId(actor.clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);

    const emptyData: ClinicalNoteResponse = {
      chief_complaint: '',
      history_of_present_illness: '',
      assessment: '',
      plan: '',
    };

    if (consultationData.consultationId?.trim()) {
      const consultation = await this.consultationRepo.findOne({
        where: { id: consultationData.consultationId.trim() },
      });
      if (!consultation) {
        throw new NotFoundException('Consultation not found');
      }
      await this.authz.assertOwnership(
        { type: 'consultation', entity: consultation },
        actor,
      );
    }

    if (!this.openai.isAvailable) {
      return { data: emptyData };
    }

    try {
      const symptomsStr = sanitizeFreeTextForAi(
        (consultationData.symptoms || []).join(', ') || 'No especificados',
        4000,
      );
      const clinicalNotes = sanitizeFreeTextForAi(
        consultationData.clinical_notes,
        6000,
      );
      const patientHistory = sanitizeFreeTextForAi(
        consultationData.patient_history,
        6000,
      );
      const messagesStr = (consultationData.messages || [])
        .map((m) =>
          `${m.role}: ${sanitizeFreeTextForAi(m.content, 2000)}`,
        )
        .join('\n');

      const systemPrompt = `Eres un transcriptor médico. Genera una nota clínica en formato SOAP.
Responde ÚNICAMENTE con un objeto JSON válido con estas claves:
- chief_complaint: string (motivo de consulta)
- history_of_present_illness: string (historia de la enfermedad actual)
- assessment: string (evaluación/diagnóstico)
- plan: string (plan de tratamiento)
Genera en español, de forma concisa y profesional. No incluyas nombres propios ni identificadores en la salida.`;

      const userPrompt = `Genera la nota clínica con:

Síntomas: ${symptomsStr}
Notas clínicas: ${clinicalNotes}
Historia clínica resumida (sin identificadores): ${patientHistory}
Mensajes de la consulta:
${messagesStr || 'N/A'}

Devuelve solo el objeto JSON.`;

      const response = await this.openai.complete(userPrompt, systemPrompt);
      const parsed = this.openai.parseJsonResponse<ClinicalNoteResponse>(response);

      if (parsed) {
        return {
          data: {
            chief_complaint: parsed.chief_complaint ?? emptyData.chief_complaint,
            history_of_present_illness:
              parsed.history_of_present_illness ?? emptyData.history_of_present_illness,
            assessment: parsed.assessment ?? emptyData.assessment,
            plan: parsed.plan ?? emptyData.plan,
          },
        };
      }
      return { data: emptyData };
    } catch {
      return { data: emptyData };
    }
  }
}
