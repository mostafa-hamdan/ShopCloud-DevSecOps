FROM python:3.12-slim
WORKDIR /app
COPY shared /shared
RUN pip install --no-cache-dir /shared
COPY services/invoice-worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/invoice-worker /app/invoice_worker
ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "invoice_worker.main"]
