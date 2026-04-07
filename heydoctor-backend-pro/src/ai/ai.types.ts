/** Structured output from {@link AiService.generateClinicalSummary} (not persisted). */
export type ClinicalSummaryResult = {
  summary: string;
  suggestedDiagnosis: string[];
  improvedNotes: string;
};

/** Assistive-only suggestions — never a diagnosis or prescription. */
export type ConsultationAssistResult = {
  assistiveOnlyNotice: string;
  possibleDiagnoses: string[];
  recommendations: string[];
  generalEducation: string[];
};
