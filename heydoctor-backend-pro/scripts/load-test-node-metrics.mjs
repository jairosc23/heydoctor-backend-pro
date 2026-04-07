#!/usr/bin/env node
/**
 * Concurrent POST /api/webrtc/metrics (smoke / capacity probe).
 *
 * Usage:
 *   node scripts/load-test-node-metrics.mjs <origin> <jwt> <consultationId> [concurrency=20] [requests=200]
 *
 * Example:
 *   node scripts/load-test-node-metrics.mjs https://api.example.com eyJhbGc... uuid... 30 300
 */
const origin = process.argv[2]?.replace(/\/$/, '') || '';
const jwt = process.argv[3] || '';
const consultationId = process.argv[4] || '';
const concurrency = Math.max(1, Number(process.argv[5] || 20));
const total = Math.max(1, Number(process.argv[6] || 200));

if (!origin || !jwt || !consultationId) {
  console.error(
    'Usage: node load-test-node-metrics.mjs <origin> <jwt> <consultationId> [concurrency] [requests]',
  );
  process.exit(1);
}

const base = origin.endsWith('/api') ? origin : `${origin}/api`;

async function one(i) {
  const body = JSON.stringify({
    consultationId,
    rtt: 40 + (i % 40),
    packetLossRatio: 0.01,
    bitrate: 750_000,
  });
  const t0 = performance.now();
  const res = await fetch(`${base}/webrtc/metrics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body,
  });
  const ms = performance.now() - t0;
  return { status: res.status, ms };
}

let idx = 0;
let ok = 0;
let fail = 0;
const latencies = [];

async function worker() {
  for (;;) {
    const my = idx++;
    if (my >= total) break;
    try {
      const { status, ms } = await one(my);
      latencies.push(ms);
      if (status === 201 || status === 403) ok++;
      else fail++;
    } catch {
      fail++;
    }
  }
}

const t0 = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const elapsed = (performance.now() - t0) / 1000;
latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

console.log(
  JSON.stringify(
    {
      total,
      concurrency,
      elapsedSec: Number(elapsed.toFixed(2)),
      rps: Number((total / elapsed).toFixed(2)),
      ok,
      fail,
      latencyMsP50: Number(p50.toFixed(1)),
      latencyMsP95: Number(p95.toFixed(1)),
    },
    null,
    2,
  ),
);
