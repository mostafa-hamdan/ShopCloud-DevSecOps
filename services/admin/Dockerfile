FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app/services/common
COPY services/admin/requirements.txt ./requirements.txt
RUN pip install --default-timeout=120 --no-cache-dir -r requirements.txt
COPY services/common /app/services/common
COPY services/admin /app/services/admin
CMD ["uvicorn", "services.admin.app.main:app", "--host", "0.0.0.0", "--port", "8005"]