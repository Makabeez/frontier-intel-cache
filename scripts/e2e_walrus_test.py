"""
End-to-end Walrus integration test for Frontier Intel Cache.

Run from backend/:
    python -m venv venv && source venv/bin/activate
    pip install -r requirements.txt
    python ../scripts/e2e_walrus_test.py

What it does:
    1. Builds a realistic intel JSON payload (scout report from "Jita")
    2. Uploads it to Walrus testnet via WalrusClient
    3. Prints the blob_id, aggregator URL, cost
    4. Fetches the blob back from the aggregator
    5. Verifies the roundtrip matches byte-for-byte

This is the "screenshot for X" demo of the Walrus integration working.
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

# Allow running from project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from walrus_client import WalrusClient  # noqa: E402


SAMPLE_INTEL = {
    "version": 1,
    "system_id": "30000142",
    "system_name": "Jita",
    "intel_type": "scout_report",
    "threat_level": 3,
    "summary": "Roaming gang camping outbound gate",
    "submitted_at_ms": int(time.time() * 1000),
    "payload": {
        "observed_ships": [
            {"class": "battleship", "count": 3, "alliance": "Goonswarm"},
            {"class": "logistics",  "count": 2, "alliance": "Goonswarm"},
            {"class": "interceptor", "count": 4, "alliance": "Unknown"},
        ],
        "estimated_duration_minutes": 120,
        "evasion_route": ["30000139", "30000136"],
        "notes": "Heavy logi support. Do not engage solo. Recommend reroute via Perimeter.",
        "scout_signature": "demo-scout-001",
    },
}


async def main() -> int:
    print("=" * 60)
    print("  Frontier Intel Cache — Walrus E2E Test")
    print("=" * 60)
    print()

    walrus = WalrusClient()
    print(f"Publisher:  {walrus.publisher_url}")
    print(f"Aggregator: {walrus.aggregator_url}")
    print()

    # 1. Upload
    print("→ Uploading sample intel to Walrus...")
    t0 = time.monotonic()
    result = await walrus.write_json(SAMPLE_INTEL, epochs=5)
    t_upload = time.monotonic() - t0

    print(f"✓ Uploaded in {t_upload:.2f}s")
    print(f"   blob_id:         {result.blob_id}")
    print(f"   sui_object_id:   {result.sui_object_id}")
    print(f"   size:            {result.size} bytes")
    print(f"   encoded_length:  {result.encoded_length:,} bytes")
    print(f"   cost:            {result.cost} MIST")
    print(f"   end_epoch:       {result.end_epoch}")
    print(f"   already_cert:    {result.already_certified}")
    print()
    print(f"   Public URL:      {walrus.public_url(result.blob_id)}")
    print()

    # 2. Read back
    print("→ Reading blob back from aggregator...")
    t0 = time.monotonic()
    fetched = await walrus.read_json(result.blob_id)
    t_read = time.monotonic() - t0
    print(f"✓ Fetched in {t_read:.2f}s")
    print()

    # 3. Verify roundtrip
    print("→ Verifying roundtrip integrity...")
    original_json = json.dumps(SAMPLE_INTEL, separators=(",", ":"), ensure_ascii=False)
    fetched_json = json.dumps(fetched, separators=(",", ":"), ensure_ascii=False)
    if original_json == fetched_json:
        print("✓ Byte-perfect roundtrip")
    else:
        print("✗ MISMATCH")
        print(f"  Original: {original_json[:200]}...")
        print(f"  Fetched:  {fetched_json[:200]}...")
        return 1

    print()
    print("=" * 60)
    print(f"  ALL GOOD. Share this URL for proof:")
    print(f"  {walrus.public_url(result.blob_id)}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
