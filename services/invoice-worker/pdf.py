"""Render an invoice PDF from an order payload using reportlab."""

from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def _cents(amount: int, currency: str) -> str:
    return f"{currency} {amount / 100:,.2f}"


def render_invoice(order: dict) -> bytes:
    """Return a PDF as bytes for the given order event payload."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    margin = 20 * mm
    y = height - margin

    # Header
    c.setFont("Helvetica-Bold", 22)
    c.drawString(margin, y, "ShopCloud")
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.drawString(margin, y, "Invoice")
    y -= 12 * mm

    # Meta block
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Order ID:")
    c.setFont("Helvetica", 10)
    c.drawString(margin + 30 * mm, y, order["order_id"])
    y -= 5 * mm

    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Customer:")
    c.setFont("Helvetica", 10)
    c.drawString(margin + 30 * mm, y, order["user_email"])
    y -= 5 * mm

    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Date:")
    c.setFont("Helvetica", 10)
    issued = order.get("created_at") or datetime.utcnow().isoformat()
    c.drawString(margin + 30 * mm, y, issued)
    y -= 12 * mm

    # Table header
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "SKU")
    c.drawString(margin + 30 * mm, y, "Item")
    c.drawRightString(margin + 110 * mm, y, "Qty")
    c.drawRightString(margin + 140 * mm, y, "Unit")
    c.drawRightString(margin + 170 * mm, y, "Total")
    y -= 2 * mm
    c.line(margin, y, width - margin, y)
    y -= 5 * mm

    # Table body
    c.setFont("Helvetica", 10)
    currency = order["currency"]
    for line in order["lines"]:
        line_total = line["unit_price_cents"] * line["qty"]
        c.drawString(margin, y, line["sku"])
        # truncate name if too long
        name = line["name"]
        if len(name) > 35:
            name = name[:32] + "..."
        c.drawString(margin + 30 * mm, y, name)
        c.drawRightString(margin + 110 * mm, y, str(line["qty"]))
        c.drawRightString(margin + 140 * mm, y, _cents(line["unit_price_cents"], currency))
        c.drawRightString(margin + 170 * mm, y, _cents(line_total, currency))
        y -= 5 * mm
        if y < 30 * mm:
            c.showPage()
            y = height - margin

    # Total
    y -= 3 * mm
    c.line(margin + 100 * mm, y, width - margin, y)
    y -= 6 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(margin + 140 * mm, y, "Total:")
    c.drawRightString(margin + 170 * mm, y, _cents(order["subtotal_cents"], currency))

    # Footer
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(margin, 15 * mm, "Thank you for shopping with ShopCloud.")

    c.showPage()
    c.save()
    return buf.getvalue()
