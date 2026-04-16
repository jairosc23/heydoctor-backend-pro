import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import type { QueryDeepPartialEntity } from 'typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './analytics-event.entity';
import type { AnalyticsCollectDto } from './dto/analytics-collect.dto';
import { normalizeAnalyticsEventName } from './dto/analytics-collect.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly repo: Repository<AnalyticsEvent>,
  ) {}

  async ingest(dto: AnalyticsCollectDto, req: Request): Promise<{ accepted: number }> {
    if (!dto.events?.length) {
      throw new BadRequestException('events required');
    }
    const ua = typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent'].slice(0, 512)
      : null;
    const rows: QueryDeepPartialEntity<AnalyticsEvent>[] = [];
    for (const e of dto.events) {
      const eventName = normalizeAnalyticsEventName(e.event);
      if (!eventName) {
        continue;
      }
      const meta: Record<string, unknown> = {
        ...(e.metadata ?? {}),
      };
      if (e.consultationId) {
        meta.consultationId = e.consultationId;
      }
      rows.push({
        eventName,
        path: e.path?.slice(0, 2048) ?? null,
        userId: dto.userId?.trim() || null,
        sessionId: dto.sessionId.trim().slice(0, 64),
        metadata: (Object.keys(meta).length ? meta : null) as
          | QueryDeepPartialEntity<AnalyticsEvent>['metadata']
          | null,
        userAgent: ua,
      });
    }
    if (rows.length === 0) {
      throw new BadRequestException('no valid events');
    }
    await this.repo.insert(rows);
    return { accepted: rows.length };
  }

  /** Sesiones únicas con page_view en [dayStart, dayEnd). */
  async countUniquePageViewSessions(
    dayStart: Date,
    dayEnd: Date,
  ): Promise<number> {
    const [row] = await this.repo.query(
      `
      SELECT COUNT(DISTINCT session_id)::int AS c
      FROM analytics_events
      WHERE event_name = 'page_view'
        AND created_at >= $1 AND created_at < $2
      `,
      [dayStart, dayEnd],
    );
    return Number(row?.c ?? 0);
  }
}
