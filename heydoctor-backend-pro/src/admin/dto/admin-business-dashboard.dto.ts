export type AdminBusinessDashboardDayDto = {
  date: string;
  consultations: number;
  revenue: number;
};

export type AdminBusinessDashboardDto = {
  /** ISO timestamp (UTC) when the snapshot was computed */
  asOf: string;
  /** Consultas creadas hoy (UTC). */
  consultationsCreated: number;
  /** Consultas cerradas hoy (estado completed / signed / locked, UTC por updated_at). */
  consultationsCompleted: number;
  /** Ingresos del día (suma pagos Payku `paid`, moneda {@link currency}). */
  totalRevenue: number;
  currency: string;
  /**
   * % de consultas creadas hoy que siguen en borrador o en curso (indicador de abandono del embudo).
   * 0–100.
   */
  abandonmentRate: number;
  /** Últimos 7 días (incluye hoy): consultas y ingresos por día. */
  byDay: AdminBusinessDashboardDayDto[];
};
