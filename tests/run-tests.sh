#!/bin/sh
set -eu

python - <<'PY'
import os
import time
import requests

targets = [
    os.environ["CATALOG_API_URL"] + "/healthz",
    os.environ["CART_API_URL"] + "/healthz",
    os.environ["CHECKOUT_API_URL"] + "/healthz",
    os.environ["AUTH_API_URL"] + "/healthz",
    os.environ["ADMIN_API_URL"] + "/healthz",
]

for target in targets:
    for _ in range(40):
        try:
            response = requests.get(target, timeout=2)
            if response.ok:
                break
        except Exception:
            pass
        time.sleep(2)
    else:
        raise SystemExit(f"Timed out waiting for {target}")
PY

pytest -q /app/tests/test_api.py