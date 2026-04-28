FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

COPY tests/requirements.txt ./requirements.txt
RUN pip install --default-timeout=120 --no-cache-dir -r requirements.txt

COPY tests /app/tests

# Strip CRLF so the script works regardless of host OS line endings.
RUN sed -i 's/\r$//' /app/tests/run-tests.sh

CMD ["sh", "/app/tests/run-tests.sh"]
