FROM python:3.12-slim
WORKDIR /app
COPY shared /shared
RUN pip install --no-cache-dir /shared
COPY services/admin/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/admin /app/admin
ENV PYTHONUNBUFFERED=1
EXPOSE 8005
CMD ["uvicorn", "admin.main:app", "--host", "0.0.0.0", "--port", "8005"]
