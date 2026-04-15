/**
 * Fetches de datos públicos de médicos para Server Components (Next.js).
 * `next.revalidate` + tag `doctors` permiten ISR y `revalidateTag('doctors')`.
 */

type NextFetchInit = RequestInit & {
  next?: { revalidate?: number; tags?: string[] };
};

function cacheInit(): NextFetchInit {
  return {
    next: { revalidate: 60, tags: ['doctors'] },
    headers: { Accept: 'application/json' },
  };
}

function normalizeBase(raw: string): string {
  return raw.replace(/\/$/, '');
}

/**
 * URL del API en servidor: preferir variable sin prefijo `NEXT_PUBLIC` si existe.
 */
export function getPublicDoctorsApiBase(): string {
  const base =
    process.env.HEYDOCTOR_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_HEYDOCTOR_API_URL?.trim() ||
    '';
  if (!base) {
    throw new Error(
      'HEYDOCTOR_API_URL or NEXT_PUBLIC_HEYDOCTOR_API_URL must be set for server doctor fetches',
    );
  }
  return normalizeBase(base);
}

export function fetchPublicDoctorsList(
  baseUrl: string = getPublicDoctorsApiBase(),
): Promise<Response> {
  return fetch(`${normalizeBase(baseUrl)}/api/doctors`, cacheInit());
}

export function fetchPublicDoctorBySlug(
  slug: string,
  baseUrl: string = getPublicDoctorsApiBase(),
): Promise<Response> {
  const enc = encodeURIComponent(slug);
  return fetch(`${normalizeBase(baseUrl)}/api/doctors/${enc}`, cacheInit());
}

export function fetchPublicDoctorRatings(
  slug: string,
  baseUrl: string = getPublicDoctorsApiBase(),
): Promise<Response> {
  const enc = encodeURIComponent(slug);
  return fetch(
    `${normalizeBase(baseUrl)}/api/doctors/${enc}/ratings`,
    cacheInit(),
  );
}
