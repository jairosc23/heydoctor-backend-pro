export type CreatePaymentSessionPayload = {
  consultationId: string;
  amount: number;
  currency: string;
  description?: string;
};

export type CreatePaymentSessionResponse = {
  provider: string;
  sessionId: string;
  status: string;
  consultationId: string;
  amount: number;
  currency: string;
  clientSecret: null;
  message: string;
};

export async function createPaymentSession(
  backendOrigin: string,
  accessToken: string,
  payload: CreatePaymentSessionPayload,
): Promise<CreatePaymentSessionResponse> {
  const url = new URL(
    '/api/payments/create-session',
    backendOrigin.replace(/\/$/, ''),
  );
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`payments/create-session ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as CreatePaymentSessionResponse;
}
