#!/usr/bin/env bash
# Heurística multi-tenant: lista hallazgos para revisión manual (no falla el CI).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== findOne / find con where: { id — revisar que exista clinicId (o equivalente) ==="
rg 'find(One)?\(\s*\{\s*where:\s*\{\s*id\s*:' src --glob '*.ts' -n || true

echo "=== find por id sin clinic en el mismo objeto (falsos positivos posibles) ==="
rg 'where:\s*\{\s*id\s*:\s*[^,}]+\s*\}' src --glob '*.ts' -n || true

echo "Hecho. Filtrar por módulo (p. ej. consultations, patients) y confirmar autorización."
