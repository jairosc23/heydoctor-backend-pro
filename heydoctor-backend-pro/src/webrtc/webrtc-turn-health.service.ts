import * as net from 'net';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { resolveTurnRegionalHosts } from './webrtc-turn-hosts.util';

export type TurnHostProbe = {
  host: string;
  ok: boolean;
  latencyMs: number | null;
  checkedAtIso: string;
};

const TURN_PORT = 3478;
const CONNECT_TIMEOUT_MS = 4000;

/**
 * Periodic TCP reachability + latency to TURN control ports (not full ICE).
 * Used to deprioritize unhealthy relays in ICE server ordering.
 */
@Injectable()
export class WebrtcTurnHealthService implements OnModuleInit {
  private readonly cache = new Map<string, TurnHostProbe>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.refreshProbes();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshProbes(): Promise<void> {
    const hosts = resolveTurnRegionalHosts(this.config);
    await Promise.all(hosts.map((h) => this.probeOne(h)));
  }

  /** Prefer healthy hosts, then by latency (asc). Unhealthy hosts move to the end. */
  prioritizeHosts(hosts: string[]): string[] {
    const scored = hosts.map((h) => {
      const p = this.cache.get(h);
      const ok = p?.ok === true;
      const lat = p?.latencyMs ?? 999_999;
      return { h, ok, lat };
    });
    scored.sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return a.lat - b.lat;
    });
    return scored.map((s) => s.h);
  }

  getSnapshot(): TurnHostProbe[] {
    return Array.from(this.cache.values()).sort((a, b) =>
      a.host.localeCompare(b.host),
    );
  }

  private probeOne(host: string): Promise<void> {
    return new Promise((resolve) => {
      const started = Date.now();
      const socket = new net.Socket();
      let done = false;

      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        try {
          socket.destroy();
        } catch {
          /* */
        }
        const latencyMs = ok ? Math.max(0, Date.now() - started) : null;
        this.cache.set(host, {
          host,
          ok,
          latencyMs,
          checkedAtIso: new Date().toISOString(),
        });
        resolve();
      };

      socket.setTimeout(CONNECT_TIMEOUT_MS);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(TURN_PORT, host);
    });
  }
}
