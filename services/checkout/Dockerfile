FROM python:3.12-slim
WORKDIR /app
COPY shared /shared
RUN pip install --no-cache-dir /shared
COPY services/checkout/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/checkout /app/checkout
ENV PYTHONUNBUFFERED=1
EXPOSE 8003
CMD ["uvicorn", "checkout.main:app", "--host", "0.0.0.0", "--port", "8003"]
