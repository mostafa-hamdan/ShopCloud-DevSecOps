"""Queue publisher.

Two backends:
  * ``sqs``   — real Amazon SQS, used in prod
  * ``local`` — appends JSON lines to a file the worker tails

The choice is purely env-driven. Producers (checkout) and consumers
(invoice-worker) both read the same env vars, so dev and prod use the
exact same code paths.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Iterator


class QueuePublisher:
    def publish(self, body: dict[str, Any]) -> str:
        raise NotImplementedError


class QueueConsumer:
    def receive(self, max_messages: int = 1, wait_seconds: int = 10) -> list["Message"]:
        raise NotImplementedError

    def delete(self, message: "Message") -> None:
        raise NotImplementedError


class Message:
    def __init__(self, body: dict[str, Any], handle: str):
        self.body = body
        self.handle = handle  # opaque — passed back to delete()


# ---------- SQS backend ----------

class SQSPublisher(QueuePublisher):
    def __init__(self, queue_url: str):
        import boto3
        self._sqs = boto3.client("sqs")
        self._queue_url = queue_url

    def publish(self, body: dict[str, Any]) -> str:
        resp = self._sqs.send_message(
            QueueUrl=self._queue_url,
            MessageBody=json.dumps(body),
        )
        return resp["MessageId"]


class SQSConsumer(QueueConsumer):
    def __init__(self, queue_url: str):
        import boto3
        self._sqs = boto3.client("sqs")
        self._queue_url = queue_url

    def receive(self, max_messages: int = 1, wait_seconds: int = 10) -> list[Message]:
        resp = self._sqs.receive_message(
            QueueUrl=self._queue_url,
            MaxNumberOfMessages=max_messages,
            WaitTimeSeconds=wait_seconds,
        )
        msgs = []
        for m in resp.get("Messages", []):
            msgs.append(Message(json.loads(m["Body"]), m["ReceiptHandle"]))
        return msgs

    def delete(self, message: Message) -> None:
        self._sqs.delete_message(QueueUrl=self._queue_url, ReceiptHandle=message.handle)


# ---------- Local file backend ----------
#
# Format: one JSON line per message, plus a sibling ".done" file listing
# message ids that have been processed. This isn't crash-safe but it's
# fine for a dev loop and it lets us inspect the queue with `cat`.

class _LocalQueueBase:
    def __init__(self, path: str):
        self._path = Path(path)
        self._done = Path(str(path) + ".done")
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.touch(exist_ok=True)
        self._done.touch(exist_ok=True)


class LocalPublisher(_LocalQueueBase, QueuePublisher):
    def publish(self, body: dict[str, Any]) -> str:
        msg_id = str(uuid.uuid4())
        record = {"id": msg_id, "body": body, "ts": time.time()}
        with self._path.open("a") as f:
            f.write(json.dumps(record) + "\n")
        return msg_id


class LocalConsumer(_LocalQueueBase, QueueConsumer):
    def _processed_ids(self) -> set[str]:
        with self._done.open() as f:
            return {line.strip() for line in f if line.strip()}

    def _all_messages(self) -> Iterator[dict]:
        with self._path.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue

    def receive(self, max_messages: int = 1, wait_seconds: int = 10) -> list[Message]:
        # Poll for ``wait_seconds`` to mimic SQS long-polling so the worker
        # loop in dev doesn't burn CPU.
        deadline = time.time() + wait_seconds
        while True:
            done = self._processed_ids()
            out: list[Message] = []
            for rec in self._all_messages():
                if rec["id"] in done:
                    continue
                out.append(Message(rec["body"], rec["id"]))
                if len(out) >= max_messages:
                    break
            if out or time.time() >= deadline:
                return out
            time.sleep(0.5)

    def delete(self, message: Message) -> None:
        with self._done.open("a") as f:
            f.write(message.handle + "\n")


# ---------- factories ----------

def get_publisher() -> QueuePublisher:
    backend = os.environ.get("QUEUE_BACKEND", "local")
    if backend == "sqs":
        return SQSPublisher(os.environ["INVOICE_QUEUE_URL"])
    return LocalPublisher(os.environ.get(
        "LOCAL_QUEUE_PATH",
        os.path.join(tempfile.gettempdir(), "shopcloud", "invoice.queue"),
    ))


def get_consumer() -> QueueConsumer:
    backend = os.environ.get("QUEUE_BACKEND", "local")
    if backend == "sqs":
        return SQSConsumer(os.environ["INVOICE_QUEUE_URL"])
    return LocalConsumer(os.environ.get(
        "LOCAL_QUEUE_PATH",
        os.path.join(tempfile.gettempdir(), "shopcloud", "invoice.queue"),
    ))
