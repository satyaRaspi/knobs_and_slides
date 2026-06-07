import os
import uvicorn

port_raw = os.getenv("PORT", "8000")
try:
    port = int(port_raw)
except ValueError:
    print(f"Invalid PORT value {port_raw!r}; falling back to 8000", flush=True)
    port = 8000

print(f"Starting Knobs and Slides Studio on 0.0.0.0:{port}", flush=True)
uvicorn.run("server:app", host="0.0.0.0", port=port, log_level="info")
