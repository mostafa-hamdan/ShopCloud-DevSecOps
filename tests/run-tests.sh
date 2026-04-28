#!/bin/sh
# Wait for every service to be healthy, then run the live integration
# tests. Used by docker compose --profile test.
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
    for attempt in range(40):
        try:
            response = requests.get(target, timeout=2)
            if response.ok:
                print(f"OK {target}")
                break
        except Exception as e:
            pass
        time.sleep(2)
    else:
        raise SystemExit(f"Timed out waiting for {target}")

print("all services up; starting pytest")
PY

pytest -q /app/tests/test_api.py
