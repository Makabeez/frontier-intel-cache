"""
Tatum Sui RPC client — Frontier Intel Cache.

Wraps standard Sui JSON-RPC, routed through Tatum's gateway:
    https://sui-testnet.gateway.tatum.io
    https://sui-mainnet.gateway.tatum.io

Why Tatum: enterprise-grade RPC with built-in rate limiting and the hackathon
explicitly weights "Best Use of Tatum Tools" as a $200 bonus on top of placement.

Authentication:
    Free tier requires no API key for basic read methods.
    For higher rate limits, set TATUM_API_KEY in .env.
    Tatum passes the key via the `x-api-key` header.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_RPC_TESTNET = "https://sui-testnet.gateway.tatum.io"
DEFAULT_RPC_MAINNET = "https://sui-mainnet.gateway.tatum.io"
DEFAULT_TIMEOUT_SECONDS = 30


@dataclass(frozen=True)
class SuiEvent:
    """A parsed Sui event of interest (IntelSubmitted, BeaconDeployed, etc.)."""
    tx_digest: str
    event_seq: str
    event_type: str       # Full type like "0x<pkg>::intel_beacon::IntelSubmitted"
    sender: str
    timestamp_ms: int
    parsed_json: dict[str, Any]   # Decoded BCS event payload


class TatumSuiError(Exception):
    """Raised when Tatum Sui RPC returns an error or unexpected response."""


class TatumSuiClient:
    """Async client for Sui JSON-RPC via Tatum gateway."""

    def __init__(
        self,
        rpc_url: str | None = None,
        api_key: str | None = None,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self.rpc_url = (rpc_url or os.getenv(
            "TATUM_SUI_RPC_URL", DEFAULT_RPC_TESTNET
        )).rstrip("/")
        self.api_key = api_key or os.getenv("TATUM_API_KEY", "")
        self._timeout = httpx.Timeout(timeout_seconds)

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

    async def _rpc(self, method: str, params: list[Any]) -> Any:
        body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
        logger.debug("Tatum Sui RPC: %s", method)

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                self.rpc_url,
                json=body,
                headers=self._headers(),
            )

        if response.status_code != 200:
            raise TatumSuiError(
                f"HTTP {response.status_code} from Tatum: {response.text[:500]}"
            )

        data = response.json()
        if "error" in data:
            raise TatumSuiError(f"Sui RPC error on {method}: {data['error']}")
        return data.get("result")

    # ------------------------------------------------------------------------
    # Health / sanity
    # ------------------------------------------------------------------------

    async def latest_checkpoint(self) -> int:
        """Returns the latest Sui checkpoint sequence number. Used for liveness checks."""
        result = await self._rpc("sui_getLatestCheckpointSequenceNumber", [])
        return int(result)

    # ------------------------------------------------------------------------
    # Events — the indexer's bread and butter
    # ------------------------------------------------------------------------

    async def query_module_events(
        self,
        package_id: str,
        module: str,
        cursor: dict[str, str] | None = None,
        limit: int = 50,
        descending: bool = True,
    ) -> dict[str, Any]:
        """
        Query all events emitted by a specific module of a package.
        Returns the raw Sui RPC result with `data` (events) and `nextCursor`.

        For our case: package_id = published Move package, module = "intel_beacon".
        """
        event_filter = {"MoveModule": {"package": package_id, "module": module}}
        params = [event_filter, cursor, limit, descending]
        return await self._rpc("suix_queryEvents", params)

    async def query_event_type(
        self,
        event_type: str,
        cursor: dict[str, str] | None = None,
        limit: int = 50,
        descending: bool = True,
    ) -> dict[str, Any]:
        """
        Query a specific event type, e.g. "0x<pkg>::intel_beacon::IntelSubmitted".
        Tighter than module filter — use when you know the exact type.
        """
        event_filter = {"MoveEventType": event_type}
        params = [event_filter, cursor, limit, descending]
        return await self._rpc("suix_queryEvents", params)

    # ------------------------------------------------------------------------
    # Objects — used to read Beacon state directly
    # ------------------------------------------------------------------------

    async def get_object(self, object_id: str) -> dict[str, Any]:
        """Fetch a Sui object with full content + display."""
        params = [object_id, {"showContent": True, "showOwner": True, "showDisplay": True}]
        return await self._rpc("sui_getObject", params)

    async def get_objects(self, object_ids: list[str]) -> list[dict[str, Any]]:
        """Batch-fetch multiple objects (more efficient than per-object calls)."""
        params = [object_ids, {"showContent": True, "showOwner": True}]
        return await self._rpc("sui_multiGetObjects", params)

    # ------------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------------

    @staticmethod
    def parse_event(raw_event: dict[str, Any]) -> SuiEvent:
        """Normalize a raw Sui RPC event into a SuiEvent dataclass."""
        event_id = raw_event.get("id", {})
        return SuiEvent(
            tx_digest=event_id.get("txDigest", ""),
            event_seq=event_id.get("eventSeq", "0"),
            event_type=raw_event.get("type", ""),
            sender=raw_event.get("sender", ""),
            timestamp_ms=int(raw_event.get("timestampMs", "0")),
            parsed_json=raw_event.get("parsedJson", {}),
        )
