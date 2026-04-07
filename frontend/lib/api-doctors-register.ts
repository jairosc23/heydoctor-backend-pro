export type RegisterDoctorPayload = {
  name: string;
  email: string;
  specialty: string;
  clinic: string;
  password: string;
};

export type RegisterDoctorResponse = {
  userId: string;
  email: string;
  clinicId: string;
  profileSlug: string;
};

export async function registerDoctor(
  backendOrigin: string,
  payload: RegisterDoctorPayload,
): Promise<RegisterDoctorResponse> {
  const url = new URL(
    '/api/doctors/register',
    backendOrigin.replace(/\/$/, ''),
  );
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`doctors/register ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as RegisterDoctorResponse;
}
