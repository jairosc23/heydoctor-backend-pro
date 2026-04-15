'use server';

import { revalidateTag } from 'next/cache';

/** Invalida entradas etiquetadas `doctors` (ISR / `fetch` con `tags: ['doctors']`). */
export async function revalidateDoctorsTag(): Promise<void> {
  revalidateTag('doctors');
}
