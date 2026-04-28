"""Invoice worker — long-running consumer.

Loop:
  1. poll the queue (long-poll)
  2. for each message:
     a. render PDF
     b. upload to S3 / local
     c. email customer with the PDF attached
     d. delete from queue
  3. on exception: log and do NOT delete — message returns to queue
     after visibility timeout

In production this is an EKS deployment scaled by KEDA on SQS depth.
"""

from __future__ import annotations

import logging
import os
import tempfile
import time
from pathlib import Path

from pyshared.mail import get_mailer
from pyshared.observability import configure_logging
from pyshared.queue import get_consumer

from .pdf import render_invoice


configure_logging("invoice-worker")
log = logging.getLogger("invoice-worker")


def _upload_pdf(order_id: str, data: bytes) -> str:
    backend = os.environ.get("STORAGE_BACKEND", "local")
    if backend == "s3":
        import boto3
        bucket = os.environ["INVOICE_BUCKET"]
        key = f"invoices/{order_id}.pdf"
        boto3.client("s3").put_object(
            Bucket=bucket, Key=key, Body=data,
            ContentType="application/pdf",
        )
        return f"s3://{bucket}/{key}"
    out_dir = Path(os.environ.get(
        "LOCAL_INVOICE_DIR",
        os.path.join(tempfile.gettempdir(), "shopcloud", "invoices"),
    ))
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{order_id}.pdf"
    path.write_bytes(data)
    return str(path)


def _process(order: dict) -> None:
    order_id = order["order_id"]
    log.info("processing invoice", extra={"order_id": order_id})

    pdf_bytes = render_invoice(order)
    location = _upload_pdf(order_id, pdf_bytes)
    log.info("invoice stored", extra={"order_id": order_id, "location": location})

    mailer = get_mailer()
    mailer.send(
        to=order["user_email"],
        subject=f"Your ShopCloud order {order_id[:8]}",
        body_text=(
            f"Hi,\n\nThanks for your order. Your total was "
            f"{order['currency']} {order['subtotal_cents']/100:,.2f}.\n\n"
            f"Invoice attached.\n\nShopCloud"
        ),
        attachments=[(f"invoice-{order_id[:8]}.pdf", pdf_bytes, "application/pdf")],
    )
    log.info("invoice emailed", extra={"order_id": order_id, "to": order["user_email"]})


def main() -> None:
    consumer = get_consumer()
    log.info("invoice worker started",
             extra={"backend": os.environ.get("QUEUE_BACKEND", "local")})

    while True:
        try:
            messages = consumer.receive(max_messages=5, wait_seconds=10)
        except Exception:
            log.exception("error receiving messages, backing off 5s")
            time.sleep(5)
            continue

        for msg in messages:
            try:
                if msg.body.get("type") != "invoice.requested":
                    log.warning("ignoring unknown event type",
                                extra={"type": msg.body.get("type")})
                    consumer.delete(msg)
                    continue
                _process(msg.body)
                consumer.delete(msg)
            except Exception:
                log.exception("failed to process message; will retry")


if __name__ == "__main__":
    main()
