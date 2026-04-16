/** Valor por defecto alineado con `CONSULTATION_PAYMENT_AMOUNT_CLP` en `.env.example`. */
export const DEFAULT_CONSULTATION_AMOUNT_CLP = 15_000;

export type ConsultationPriceResponse = {
  amount: number;
  currency: 'CLP';
};

/**
 * Misma lógica que Payku / UI: entero positivo CLP; fallback si env es inválido.
 */
export function normalizeConsultationAmountClp(raw: number): number {
  if (Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  return DEFAULT_CONSULTATION_AMOUNT_CLP;
}

export function toConsultationPriceResponse(raw: number): ConsultationPriceResponse {
  return {
    amount: normalizeConsultationAmountClp(raw),
    currency: 'CLP',
  };
}
