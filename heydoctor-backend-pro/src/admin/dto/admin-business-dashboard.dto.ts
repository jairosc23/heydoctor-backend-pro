export type AdminBusinessDashboardDayDto = {
  date: string;
  consultations: number;
  revenue: number;
};

/** Embudo del día (UTC). `visits` es proxy vía auditoría si existe tráfico. */
export type AdminBusinessFunnelDto = {
  /** Visitas proxy: lecturas/listados de consultas exitosos en audit_logs; null si no aplica. */
  visits: number | null;
  visitsSource: string;
  created: number;
  /** Consultas distintas con pago `paid` hoy (Payku vinculado). */
  paid: number;
  completed: number;
};

export type DoctorPerformanceRowDto = {
  doctorId: string;
  displayName: string;
  /** Consultas distintas con ingreso atribuido hoy (pagos asociados). */
  consultationsWithRevenue: number;
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
  /** Pagos exitosos / consultas creadas hoy (0–100). */
  conversionRate: number;
  /**
   * Pacientes con 2+ consultas creadas en los últimos 30 días (UTC) — retención.
   */
  repeatUsers: number;
  /** Tiempo medio en minutos desde creación hasta cierre (terminal) para consultas cerradas hoy. */
  avgConsultationTimeMinutes: number | null;
  /** Ingreso del día / médicos con ingreso hoy (0 si ninguno). */
  revenuePerDoctor: number;
  funnel: AdminBusinessFunnelDto;
  /** Top médicos por ingreso hoy (máx. 25). */
  doctorPerformance: DoctorPerformanceRowDto[];
  /** Últimos 7 días (incluye hoy): consultas y ingresos por día. */
  byDay: AdminBusinessDashboardDayDto[];
};
