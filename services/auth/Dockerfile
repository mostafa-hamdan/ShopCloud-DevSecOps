FROM python:3.12-slim

WORKDIR /app

# Install shared library first so it's cached separately
COPY shared /shared
RUN pip install --no-cache-dir /shared

COPY services/auth/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/auth /app/auth

ENV PYTHONUNBUFFERED=1
EXPOSE 8004

CMD ["uvicorn", "auth.main:app", "--host", "0.0.0.0", "--port", "8004"]
