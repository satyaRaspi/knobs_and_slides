#!/bin/sh
set -eu
PORT_VALUE="${PORT:-8000}"
echo "============================================================"
echo "Knobs and Slides Studio starting"
echo "Binding host: 0.0.0.0"
echo "Binding port: ${PORT_VALUE}"
echo "Health URLs: /health and /api/health"
echo "============================================================"
exec python -m uvicorn server:app --host 0.0.0.0 --port "${PORT_VALUE}" --log-level info
