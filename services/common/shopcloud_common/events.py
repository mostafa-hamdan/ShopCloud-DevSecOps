from datetime import datetime, timezone
from pathlib import Path
import json
import uuid


def write_checkout_event(events_path: str, payload: dict) -> str:
    Path(events_path).mkdir(parents=True, exist_ok=True)
    event_name = f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex}.json"
    event_path = Path(events_path) / event_name
    enriched_payload = {
        "version": "1.0",
        **payload,
        "timestamp": payload.get("timestamp") or datetime.now(timezone.utc).isoformat(),
    }
    event_path.write_text(json.dumps(enriched_payload, indent=2), encoding="utf-8")
    return str(event_path)