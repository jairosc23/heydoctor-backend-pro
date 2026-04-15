import { SetMetadata } from '@nestjs/common';

/** Metadatos: coste en “tokens” del bucket default (1 = comportamiento estándar). */
export const THROTTLE_ROUTE_COST = 'heydoctor:throttleRouteCost' as const;

export const ThrottleRouteCost = (cost: number): ReturnType<typeof SetMetadata> =>
  SetMetadata(THROTTLE_ROUTE_COST, cost);
