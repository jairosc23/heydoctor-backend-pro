/** Structured output from {@link AiService.generateClinicalSummary} (not persisted). */
export type ClinicalSummaryResult = {
  summary: string;
  suggestedDiagnosis: string[];
  improvedNotes: string;
};
