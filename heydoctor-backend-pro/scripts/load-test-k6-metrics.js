/**
 * k6 load test — WebRTC metrics POST
 *
 * Usage:
 *   API_BASE=https://host/api JWT=eyJ... CONSULTATION_ID=uuid k6 run scripts/load-test-k6-metrics.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const base = (__ENV.API_BASE || 'http://localhost:3000/api').replace(/\/$/, '');
const token = __ENV.JWT || '';
const consultationId = __ENV.CONSULTATION_ID || '';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  if (!token || !consultationId) {
    return;
  }
  const res = http.post(
    `${base}/webrtc/metrics`,
    JSON.stringify({
      consultationId,
      rtt: 45 + Math.random() * 30,
      packetLossRatio: Math.random() * 0.02,
      bitrate: 800_000,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );
  check(res, { '201 or 403': (r) => r.status === 201 || r.status === 403 });
  sleep(0.3);
}
