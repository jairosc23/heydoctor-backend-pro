import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * JSON shape returned for RTCPeerConnectionConfiguration.iceServers.
 * Multiple regional TURN URIs share the same time-limited credential when using TURN REST API.
 */
export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const DEFAULT_REGIONAL_HOSTS = [
  'turn-scl.heydoctor.health',
  'turn-gru.heydoctor.health',
  'turn-bog.heydoctor.health',
] as const;

/**
 * Builds ICE server list: STUN (Google + regional) + TURN (udp/tcp/tls) per regional host.
 * Uses coturn-compatible ephemeral credentials when {@link TURN_REST_SECRET} is set.
 */
@Injectable()
export class WebrtcTurnService {
  constructor(private readonly config: ConfigService) {}

  /**
   * @param userId — sub claim; embedded in TURN username for traceability (no PHI).
   */
  buildIceServers(userId: string): IceServerConfig[] {
    const secret = this.config
      .get<string>('TURN_REST_SECRET')
      ?.trim();
    const staticUser = this.config
      .get<string>('TURN_HEYDOCTOR_USERNAME')
      ?.trim();
    const staticPass = this.config
      .get<string>('TURN_HEYDOCTOR_CREDENTIAL')
      ?.trim();

    const ttl = Math.min(
      Math.max(
        Number(this.config.get('TURN_CREDENTIAL_TTL_SEC')) || 86_400,
        600,
      ),
      86_400 * 7,
    );

    const hosts = this.resolveRegionalHosts();
    const creds = this.tryResolveCredentials(
      userId,
      secret,
      staticUser,
      staticPass,
      ttl,
    );

    const servers: IceServerConfig[] = [];

    servers.push({ urls: 'stun:stun.l.google.com:19302' });

    for (const host of hosts) {
      servers.push({ urls: `stun:${host}:3478` });
    }

    if (!creds) {
      return servers;
    }

    const { username, credential } = creds;
    for (const host of hosts) {
      const turnBase = [
        `turn:${host}:3478?transport=udp`,
        `turn:${host}:3478?transport=tcp`,
        `turns:${host}:5349`,
      ];
      for (const url of turnBase) {
        servers.push({
          urls: url,
          username,
          credential,
        });
      }
    }

    return servers;
  }

  private resolveRegionalHosts(): string[] {
    const raw = this.config.get<string>('TURN_REGIONAL_HOSTS')?.trim();
    if (raw) {
      return raw
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
    }
    return [...DEFAULT_REGIONAL_HOSTS];
  }

  private tryResolveCredentials(
    userId: string,
    secret: string | undefined,
    staticUser: string | undefined,
    staticPass: string | undefined,
    ttlSec: number,
  ): { username: string; credential: string } | null {
    if (secret) {
      const expiry = Math.floor(Date.now() / 1000) + ttlSec;
      const safeUserId = this.safeTurnUserSegment(userId);
      const username = `${expiry}:${safeUserId}`;
      const credential = createHmac('sha1', secret)
        .update(username)
        .digest('base64');
      return { username, credential };
    }

    if (staticUser && staticPass) {
      return { username: staticUser, credential: staticPass };
    }

    return null;
  }

  /** Avoid colon-only usernames breaking expiry:user parsing on coturn. */
  private safeTurnUserSegment(userId: string): string {
    const u = userId.replace(/:/g, '_').slice(0, 64);
    return u.length ? u : 'user';
  }
}
