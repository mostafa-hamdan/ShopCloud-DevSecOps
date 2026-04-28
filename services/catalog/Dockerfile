FROM python:3.12-slim
WORKDIR /app
COPY shared /shared
RUN pip install --no-cache-dir /shared
COPY services/catalog/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/catalog /app/catalog
ENV PYTHONUNBUFFERED=1
EXPOSE 8001
CMD ["uvicorn", "catalog.main:app", "--host", "0.0.0.0", "--port", "8001"]
