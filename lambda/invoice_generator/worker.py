import json
import os
from pathlib import Path
import time

from .generator import generate_invoice_pdf

EVENTS_PATH = Path(os.getenv("EVENTS_PATH", "/app/runtime/events"))
INVOICE_STORAGE_PATH = Path(os.getenv("INVOICE_STORAGE_PATH", "/app/runtime/invoices"))
INVOICE_OUTBOX_PATH = Path(os.getenv("INVOICE_OUTBOX_PATH", "/app/runtime/outbox"))


def process_event(event_path: Path) -> None:
    payload = json.loads(event_path.read_text(encoding="utf-8"))
    pdf_path = INVOICE_STORAGE_PATH / f"invoice-{payload['order_id']}.pdf"
    generate_invoice_pdf(pdf_path, payload)

    INVOICE_OUTBOX_PATH.mkdir(parents=True, exist_ok=True)
    email_record = INVOICE_OUTBOX_PATH / f"invoice-{payload['order_id']}.txt"
    email_record.write_text(
        f"To: {payload['customer_email']}\nSubject: ShopCloud invoice {payload['order_id']}\nAttachment: {pdf_path.name}\n",
        encoding="utf-8",
    )
    event_path.unlink(missing_ok=True)


def main() -> None:
    EVENTS_PATH.mkdir(parents=True, exist_ok=True)
    INVOICE_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    INVOICE_OUTBOX_PATH.mkdir(parents=True, exist_ok=True)

    while True:
        for event_file in sorted(EVENTS_PATH.glob('*.json')):
            process_event(event_file)
        time.sleep(2)


if __name__ == '__main__':
    main()