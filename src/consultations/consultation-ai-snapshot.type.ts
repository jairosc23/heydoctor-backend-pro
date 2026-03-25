/** AI assistant output exposed at GET /consultations/:id/ai (null until first successful generation). */
export type ConsultationAiSnapshot = {
  summary: string | null;
  suggestedDiagnosis: string[] | null;
  improvedNotes: string | null;
  generatedAt: Date | null;
};
