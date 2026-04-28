"""Email sender. SES in prod, local file in dev so we can read what we sent."""

from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path
from typing import Optional


class Mailer:
    def send(
        self,
        to: str,
        subject: str,
        body_text: str,
        attachments: Optional[list[tuple[str, bytes, str]]] = None,
    ) -> None:
        raise NotImplementedError


class SESMailer(Mailer):
    def __init__(self, from_addr: str):
        import boto3
        self._ses = boto3.client("sesv2")
        self._from = from_addr

    def send(self, to, subject, body_text, attachments=None):
        # SESv2 raw email so we can attach the PDF.
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["From"] = self._from
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body_text)

        for filename, data, mime in attachments or []:
            maintype, subtype = mime.split("/", 1)
            msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

        self._ses.send_email(
            FromEmailAddress=self._from,
            Destination={"ToAddresses": [to]},
            Content={"Raw": {"Data": msg.as_bytes()}},
        )


class LocalMailer(Mailer):
    def __init__(self, outbox: str):
        self._outbox = Path(outbox)
        self._outbox.mkdir(parents=True, exist_ok=True)

    def send(self, to, subject, body_text, attachments=None):
        ts = int(time.time() * 1000)
        # one folder per email so attachments live alongside the body
        folder = self._outbox / f"{ts}-{to.replace('@', '_at_')}"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "subject.txt").write_text(subject)
        (folder / "body.txt").write_text(body_text)
        for filename, data, _mime in attachments or []:
            (folder / filename).write_bytes(data)


def get_mailer() -> Mailer:
    backend = os.environ.get("MAIL_BACKEND", "local")
    from_addr = os.environ.get("MAIL_FROM", "no-reply@shopcloud.local")
    if backend == "ses":
        return SESMailer(from_addr)
    return LocalMailer(os.environ.get(
        "LOCAL_MAIL_DIR",
        os.path.join(tempfile.gettempdir(), "shopcloud", "outbox"),
    ))
