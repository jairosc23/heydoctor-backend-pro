import { createHash } from 'crypto';

function shortDigest(payload: Record<string, string>): string {
  return createHash('sha256')
    .update(JSON.stringify(payload), 'utf8')
    .digest('hex')
    .slice(0, 32);
}

/** Idempotencia: mismo destino + plantilla + dedupe → mismo jobId en cola `email`. */
export function emailQueueJobId(input: {
  templateId: string;
  recipientKey: string;
  dedupeExtra?: string;
}): string {
  return `email:${shortDigest({
    t: input.templateId,
    r: input.recipientKey,
    x: input.dedupeExtra ?? '',
  })}`;
}

/** Idempotencia: mismo recurso + tipo de PDF → un job en cola `pdf`. */
export function pdfQueueJobId(input: {
  kind: string;
  resourceId: string;
  variant?: string;
}): string {
  return `pdf:${shortDigest({
    k: input.kind,
    id: input.resourceId,
    v: input.variant ?? '',
  })}`;
}

/** Idempotencia: evento + destino + huella opcional del cuerpo. */
export function webhookQueueJobId(input: {
  event: string;
  targetKey: string;
  payloadDigest?: string;
}): string {
  return `webhook:${shortDigest({
    e: input.event,
    k: input.targetKey,
    p: input.payloadDigest ?? '',
  })}`;
}
