declare module 'next/cache' {
  export function revalidateTag(tag: string): void;
}

declare module 'next/server' {
  export class NextRequest {
    constructor(input: URL | string, init?: RequestInit);
    headers: Headers;
  }
  export class NextResponse {
    static json(
      body: unknown,
      init?: { status?: number; headers?: HeadersInit },
    ): NextResponse;
  }
}
