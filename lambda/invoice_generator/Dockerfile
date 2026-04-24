FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY lambda/invoice_generator/requirements.txt ./requirements.txt
RUN pip install --default-timeout=120 --no-cache-dir -r requirements.txt
COPY lambda /app/lambda
CMD ["python", "-m", "lambda.invoice_generator.worker"]