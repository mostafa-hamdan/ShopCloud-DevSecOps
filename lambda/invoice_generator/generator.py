from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def generate_invoice_pdf(output_path: Path, payload: dict) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output_path), pagesize=letter)
    pdf.setTitle(f"Invoice {payload['order_id']}")
    pdf.drawString(72, 750, f"ShopCloud Invoice #{payload['order_id']}")
    pdf.drawString(72, 730, f"Customer: {payload['customer_email']}")
    pdf.drawString(72, 710, f"Generated: {payload['timestamp']}")
    y = 680
    for item in payload['line_items']:
        pdf.drawString(72, y, f"{item['product_name']} x {item['quantity']} - ${item['line_total']:.2f}")
        y -= 20
    pdf.drawString(72, y - 10, f"Total: ${payload['totals']['grand_total']:.2f}")
    pdf.save()
    return output_path