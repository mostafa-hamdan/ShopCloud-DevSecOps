"""Shared utilities used by every ShopCloud service.

Kept deliberately small. Three concerns only:
  * JWT issue / verify (local HS256 in dev, Cognito JWKS in prod)
  * Queue publish (local file in dev, SQS in prod)
  * Mail send (local file in dev, SES in prod)

Each module exposes a single factory that reads env vars and returns
the right backend. Services never import the backends directly.
"""
