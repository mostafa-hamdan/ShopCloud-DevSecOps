FROM python:3.12-slim
WORKDIR /app
COPY shared /shared
RUN pip install --no-cache-dir /shared
COPY services/cart/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/cart /app/cart
ENV PYTHONUNBUFFERED=1
EXPOSE 8002
CMD ["uvicorn", "cart.main:app", "--host", "0.0.0.0", "--port", "8002"]
