"""
Walrus HTTP client — Frontier Intel Cache.

Uses the public Walrus testnet publisher and aggregator (REST API).
No Walrus TS SDK required. No Sui SDK required to read blobs.

Why HTTP API instead of the TS SDK:
    - TS SDK requires ~2200 storage-node requests per blob write
    - Publisher (HTTP) does it all server-side and returns the blob_id
    - Aggregator (HTTP) handles read fan-out to storage nodes
    - For the dashboard, this is the right abstraction

Endpoints (Walrus testnet, May 2026):
    Publisher:  https://publisher.walrus-testnet.walrus.space
    Aggregator: https://aggregator.walrus-testnet.walrus.space

If the public publisher/aggregator is rate-limited, swap WALRUS_PUBLISHER_URL
and WALRUS_AGGREGATOR_URL in .env to point to a self-hosted instance.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_PUBLISHER = "https://publisher.walrus-testnet.walrus.space"
DEFAULT_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space"
DEFAULT_EPOCHS = 5
DEFAULT_TIMEOUT_SECONDS = 60  # Walrus writes can be slow on public testnet


@dataclass(frozen=True)
class BlobWriteResult:
    """Result of a successful Walrus blob write."""
    blob_id: str
    sui_object_id: str
    size: int
    encoded_length: int
    cost: int
    end_epoch: int
    already_certified: bool  # True if Walrus deduped to an existing blob


class WalrusError(Exception):
    """Raised when Walrus publisher/aggregator returns an unexpected response."""


class WalrusClient:
    """Thin async wrapper around Walrus HTTP publisher + aggregator."""

    def __init__(
        self,
        publisher_url: str | None = None,
        aggregator_url: str | None = None,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self.publisher_url = (publisher_url or os.getenv(
            "WALRUS_PUBLISHER_URL", DEFAULT_PUBLISHER
        )).rstrip("/")
        self.aggregator_url = (aggregator_url or os.getenv(
            "WALRUS_AGGREGATOR_URL", DEFAULT_AGGREGATOR
        )).rstrip("/")
        self._timeout = httpx.Timeout(timeout_seconds)

    # ------------------------------------------------------------------------
    # WRITE
    # ------------------------------------------------------------------------

    async def write_blob(
        self,
        payload: bytes,
        epochs: int = DEFAULT_EPOCHS,
    ) -> BlobWriteResult:
        """Upload bytes to Walrus. Returns BlobWriteResult with the blob_id."""
        if not payload:
            raise WalrusError("Refusing to write empty payload")

        url = f"{self.publisher_url}/v1/blobs?epochs={epochs}"
        logger.debug("Walrus PUT %s (%d bytes)", url, len(payload))

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.put(url, content=payload)

        if response.status_code != 200:
            raise WalrusError(
                f"Publisher returned HTTP {response.status_code}: {response.text[:500]}"
            )

        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            raise WalrusError(f"Publisher returned non-JSON: {response.text[:500]}") from exc

        return self._parse_write_response(data, len(payload))

    async def write_json(
        self,
        obj: dict[str, Any],
        epochs: int = DEFAULT_EPOCHS,
    ) -> BlobWriteResult:
        """Convenience: serialize a dict to compact JSON and upload."""
        payload = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        return await self.write_blob(payload, epochs=epochs)

    @staticmethod
    def _parse_write_response(data: dict[str, Any], original_size: int) -> BlobWriteResult:
        """Normalize Walrus publisher response (handles both newlyCreated and alreadyCertified)."""
        if "newlyCreated" in data:
            blob_obj = data["newlyCreated"]["blobObject"]
            storage = blob_obj["storage"]
            return BlobWriteResult(
                blob_id=blob_obj["blobId"],
                sui_object_id=blob_obj["id"],
                size=blob_obj["size"],
                encoded_length=data["newlyCreated"]["resourceOperation"]
                    .get("registerFromScratch", {})
                    .get("encodedLength", 0),
                cost=data["newlyCreated"].get("cost", 0),
                end_epoch=storage["endEpoch"],
                already_certified=False,
            )
        if "alreadyCertified" in data:
            cert = data["alreadyCertified"]
            return BlobWriteResult(
                blob_id=cert["blobId"],
                sui_object_id=cert.get("event", {}).get("txDigest", ""),
                size=original_size,
                encoded_length=0,
                cost=0,
                end_epoch=cert.get("endEpoch", 0),
                already_certified=True,
            )
        raise WalrusError(f"Unexpected publisher response shape: {list(data.keys())}")

    # ------------------------------------------------------------------------
    # READ
    # ------------------------------------------------------------------------

    async def read_blob(self, blob_id: str) -> bytes:
        """Fetch raw bytes for a blob_id from the aggregator."""
        if not blob_id:
            raise WalrusError("Empty blob_id")

        url = f"{self.aggregator_url}/v1/blobs/{blob_id}"
        logger.debug("Walrus GET %s", url)

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(url)

        if response.status_code == 404:
            raise WalrusError(f"Blob not found: {blob_id}")
        if response.status_code != 200:
            raise WalrusError(
                f"Aggregator returned HTTP {response.status_code} for {blob_id}"
            )
        return response.content

    async def read_json(self, blob_id: str) -> dict[str, Any]:
        """Fetch a blob and parse as JSON. Raises WalrusError on parse failure."""
        raw = await self.read_blob(blob_id)
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise WalrusError(f"Blob {blob_id} is not valid JSON: {exc}") from exc

    def public_url(self, blob_id: str) -> str:
        """The public, CDN-cacheable URL for a blob. Shareable in tweets, embeddable, etc."""
        return f"{self.aggregator_url}/v1/blobs/{blob_id}"
