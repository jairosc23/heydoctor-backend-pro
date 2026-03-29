import { ConfigService } from '@nestjs/config';

/**
 * Central compliance configuration.
 *
 * HIPAA_MODE: when true, enables stricter logging and PHI access controls.
 * Controlled via environment variable HIPAA_MODE=true.
 * Default: false (standard Ley 19.628 / GDPR compliance).
 *
 * When HIPAA_MODE is active:
 * - All PHI field access is logged with extended metadata
 * - Clinical data responses include PHI access audit headers
 * - Session limits are reduced to 3 (stricter than standard 5)
 * - Token TTL is shortened to 10 minutes
 */
export class ComplianceConfig {
  readonly hipaaMode: boolean;
  readonly gdprEnabled: boolean;
  readonly phiAccessLogging: boolean;
  readonly maxSessionsPerUser: number;
  readonly accessTokenTtlMinutes: number;

  constructor(configService: ConfigService) {
    this.hipaaMode =
      configService.get<string>('HIPAA_MODE')?.toLowerCase() === 'true';
    this.gdprEnabled = true;
    this.phiAccessLogging = this.hipaaMode;
    this.maxSessionsPerUser = this.hipaaMode ? 3 : 5;
    this.accessTokenTtlMinutes = this.hipaaMode ? 10 : 15;
  }
}

export const COMPLIANCE_CONFIG_TOKEN = 'COMPLIANCE_CONFIG';
