export type PaginatedResult<T> = {
  data: T[];
  /**
   * Total de filas (paginación offset). Con cursor suele ser `-1` (no calculado).
   */
  total: number;
  page: number;
  limit: number;
  /** Siguiente página (cursor); `null` si no hay más. */
  nextCursor?: string | null;
  hasMore?: boolean;
};
