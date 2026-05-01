from __future__ import annotations

import io
import json
import os
from datetime import datetime
from email.message import EmailMessage

import boto3
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def _money(cents: int, currency: str) -> str:
    return f"{currency} {cents / 100:,.2f}"


def _render_pdf(order: dict) -> bytes:
    buf = io.BytesIO()
    pdf = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    margin = 20 * mm
    y = height - margin

    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(margin, y, "ShopCloud")
    y -= 10 * mm
    pdf.setFont("Helvetica", 11)
    pdf.drawString(margin, y, "Invoice")
    y -= 12 * mm

    pdf.setFont("Helvetica", 10)
    pdf.drawString(margin, y, f"Order ID: {order['order_id']}")
    y -= 6 * mm
    pdf.drawString(margin, y, f"Customer: {order['user_email']}")
    y -= 6 * mm
    pdf.drawString(margin, y, f"Date: {order.get('created_at') or datetime.utcnow().isoformat()}")
    y -= 12 * mm

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(margin, y, "SKU")
    pdf.drawString(margin + 30 * mm, y, "Item")
    pdf.drawRightString(margin + 110 * mm, y, "Qty")
    pdf.drawRightString(margin + 140 * mm, y, "Unit")
    pdf.drawRightString(margin + 170 * mm, y, "Total")
    y -= 2 * mm
    pdf.line(margin, y, width - margin, y)
    y -= 6 * mm

    currency = order["currency"]
    pdf.setFont("Helvetica", 10)
    for line in order["lines"]:
        name = line["name"][:35]
        line_total = line["unit_price_cents"] * line["qty"]
        pdf.drawString(margin, y, line["sku"])
        pdf.drawString(margin + 30 * mm, y, name)
        pdf.drawRightString(margin + 110 * mm, y, str(line["qty"]))
        pdf.drawRightString(margin + 140 * mm, y, _money(line["unit_price_cents"], currency))
        pdf.drawRightString(margin + 170 * mm, y, _money(line_total, currency))
        y -= 6 * mm

    y -= 4 * mm
    pdf.line(margin + 100 * mm, y, width - margin, y)
    y -= 7 * mm
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawRightString(margin + 140 * mm, y, "Total:")
    pdf.drawRightString(margin + 170 * mm, y, _money(order["subtotal_cents"], currency))

    pdf.setFont("Helvetica-Oblique", 8)
    pdf.drawString(margin, 15 * mm, "Thank you for shopping with ShopCloud.")
    pdf.showPage()
    pdf.save()
    return buf.getvalue()


def _send_email(sender: str, order: dict, pdf_bytes: bytes) -> None:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = order["user_email"]
    msg["Subject"] = f"Your ShopCloud invoice {order['order_id'][:8]}"
    msg.set_content(
        "Thanks for your ShopCloud order.\n\n"
        f"Total: {_money(order['subtotal_cents'], order['currency'])}\n\n"
        "Your invoice is attached."
    )
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=f"invoice-{order['order_id'][:8]}.pdf",
    )
    boto3.client("sesv2").send_email(
        FromEmailAddress=sender,
        Destination={"ToAddresses": [order["user_email"]]},
        Content={"Raw": {"Data": msg.as_bytes()}},
    )


def lambda_handler(event, _context):
    bucket = os.environ["INVOICE_BUCKET"]
    sender = os.environ["EMAIL_SENDER"]
    s3 = boto3.client("s3")

    processed = 0
    for record in event.get("Records", []):
        order = json.loads(record["body"])
        if order.get("type") != "invoice.requested":
            continue
        pdf_bytes = _render_pdf(order)
        key = f"invoices/{order['order_id']}.pdf"
        s3.put_object(Bucket=bucket, Key=key, Body=pdf_bytes, ContentType="application/pdf")
        _send_email(sender, order, pdf_bytes)
        processed += 1
    return {"processed": processed}
