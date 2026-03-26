import { SubscriptionChangeReasonCode } from './subscription.entity';

export const COMMON_REASON_KEYWORDS: Array<{
  keyword: string;
  code: SubscriptionChangeReasonCode;
}> = [
  { keyword: 'trial', code: SubscriptionChangeReasonCode.TRIAL },
  { keyword: 'compensation', code: SubscriptionChangeReasonCode.SUPPORT },
  { keyword: 'support', code: SubscriptionChangeReasonCode.SUPPORT },
  { keyword: 'sales', code: SubscriptionChangeReasonCode.SALES },
  { keyword: 'refund', code: SubscriptionChangeReasonCode.REFUND },
];

/**
 * Best-effort mapping for analytics consistency.
 * Never throws; returns undefined when no keyword matches.
 */
export function normalizeReasonCode(
  reasonText?: string,
): SubscriptionChangeReasonCode | undefined {
  if (!reasonText) return undefined;
  const lower = reasonText.toLowerCase();
  for (const item of COMMON_REASON_KEYWORDS) {
    if (lower.includes(item.keyword)) {
      return item.code;
    }
  }
  return undefined;
}
