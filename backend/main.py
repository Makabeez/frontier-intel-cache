"""
Frontier Intel Cache — FastAPI backend.

Responsibilities:
    1. Health / smoke endpoints
    2. Walrus upload proxy (so frontend doesn't need to handle huge PUTs)
    3. Sui event indexer (polls Tatum for IntelSubmitted events, caches in SQLite)
    4. WebSocket stream of new intel for live dashboard updates
    5. Read-through cache for Walrus blob fetches

The Sui transaction itself (calling submit_intel on the Move contract) is signed
on the client side via the user's wallet — backend never holds keys.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from tatum_sui_client import TatumSuiClient, TatumSuiError
from walrus_client import WalrusClient, WalrusError

load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("frontier-intel")

# ============================================================================
# CONFIG
# ============================================================================

PACKAGE_ID = os.getenv("FRONTIER_INTEL_PACKAGE_ID", "")  # Set after Move publish
INDEXER_POLL_SECONDS = int(os.getenv("INDEXER_POLL_SECONDS", "5"))
SQLITE_PATH = os.getenv("SQLITE_PATH", "./intel-cache.sqlite")
PORT = int(os.getenv("PORT", "8090"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

walrus = WalrusClient()
sui = TatumSuiClient()

# ============================================================================
# SQLITE — minimal index of seen IntelSubmitted events
# ============================================================================

def db_init() -> None:
    """Create the intel table if it doesn't exist."""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS intel (
            tx_digest        TEXT,
            event_seq        TEXT,
            beacon_id        TEXT,
            intel_id         TEXT,
            submitter        TEXT,
            system_id        TEXT,
            intel_type       TEXT,
            threat_level     INTEGER,
            walrus_blob_id   TEXT,
            summary          TEXT,
            timestamp_ms     INTEGER,
            PRIMARY KEY (tx_digest, event_seq)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_intel_timestamp ON intel(timestamp_ms DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_intel_system ON intel(system_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_intel_threat ON intel(threat_level)")
    conn.commit()
    conn.close()


def db_insert_intel(event: dict[str, Any]) -> bool:
    """Insert a parsed IntelSubmitted event. Returns True if new, False if duplicate."""
    payload = event.get("parsed_json", {})
    conn = sqlite3.connect(SQLITE_PATH)
    try:
        conn.execute(
            """INSERT INTO intel (
                tx_digest, event_seq, beacon_id, intel_id, submitter,
                system_id, intel_type, threat_level, walrus_blob_id, summary, timestamp_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                event["tx_digest"],
                event["event_seq"],
                payload.get("beacon_id", ""),
                payload.get("intel_id", ""),
                payload.get("submitter", ""),
                payload.get("system_id", ""),
                payload.get("intel_type", ""),
                int(payload.get("threat_level", 0)),
                payload.get("walrus_blob_id", ""),
                payload.get("summary", ""),
                int(payload.get("timestamp_ms", 0)),
            ),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def db_recent_intel(limit: int = 50, system_id: str | None = None) -> list[dict[str, Any]]:
    """Fetch recent intel, newest first. Optional system_id filter."""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    if system_id:
        rows = conn.execute(
            "SELECT * FROM intel WHERE system_id = ? ORDER BY timestamp_ms DESC LIMIT ?",
            (system_id, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM intel ORDER BY timestamp_ms DESC LIMIT ?",
            (limit,),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ============================================================================
# WEBSOCKET — broadcast new intel to connected dashboards
# ============================================================================

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        logger.info("WS connected (%d total)", len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)
        logger.info("WS disconnected (%d total)", len(self._connections))

    async def broadcast(self, message: dict[str, Any]) -> None:
        if not self._connections:
            return
        text = json.dumps(message)
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.discard(ws)


ws_manager = ConnectionManager()

# ============================================================================
# INDEXER LOOP — polls Tatum for new IntelSubmitted events
# ============================================================================

async def indexer_loop() -> None:
    """Background task: poll Sui for new IntelSubmitted events, store, broadcast."""
    if not PACKAGE_ID:
        logger.warning("FRONTIER_INTEL_PACKAGE_ID not set — indexer running in idle mode")
        while True:
            await asyncio.sleep(30)

    event_type = f"{PACKAGE_ID}::intel_beacon::IntelSubmitted"
    logger.info("Indexer started for event type: %s", event_type)

    while True:
        try:
            result = await sui.query_event_type(event_type, limit=50, descending=True)
            events = result.get("data", []) if isinstance(result, dict) else []
            new_count = 0

            for raw in reversed(events):  # process oldest first so SQLite order makes sense
                parsed = sui.parse_event(raw)
                event_dict = {
                    "tx_digest": parsed.tx_digest,
                    "event_seq": parsed.event_seq,
                    "event_type": parsed.event_type,
                    "sender": parsed.sender,
                    "timestamp_ms": parsed.timestamp_ms,
                    "parsed_json": parsed.parsed_json,
                }
                if db_insert_intel(event_dict):
                    new_count += 1
                    await ws_manager.broadcast({"kind": "intel_submitted", "event": event_dict})

            if new_count:
                logger.info("Indexer: %d new intel records ingested", new_count)
        except TatumSuiError as exc:
            logger.warning("Indexer Sui RPC error: %s", exc)
        except Exception:
            logger.exception("Indexer unexpected error")

        await asyncio.sleep(INDEXER_POLL_SECONDS)


# ============================================================================
# APP LIFESPAN
# ============================================================================

@asynccontextmanager
async def lifespan(_app: FastAPI):
    db_init()
    Path(SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)
    indexer_task = asyncio.create_task(indexer_loop())
    logger.info("Frontier Intel Cache backend started on port %d", PORT)
    yield
    indexer_task.cancel()
    try:
        await indexer_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Frontier Intel Cache", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# MODELS
# ============================================================================

class IntelUploadRequest(BaseModel):
    """Client posts the structured intel payload here; we store on Walrus and return blob_id.
    The client then signs the Sui submit_intel(...) tx with the returned blob_id."""
    system_id: str = Field(..., min_length=1, max_length=64)
    intel_type: str = Field(..., min_length=1, max_length=64)
    threat_level: int = Field(..., ge=1, le=4)
    summary: str = Field(..., max_length=200)
    payload: dict[str, Any]  # the full structured intel — anything JSON-serializable


class IntelUploadResponse(BaseModel):
    blob_id: str
    aggregator_url: str
    size_bytes: int
    walrus_cost: int
    end_epoch: int
    already_certified: bool


# ============================================================================
# ROUTES
# ============================================================================

@app.get("/api/health")
async def health() -> dict[str, Any]:
    """Liveness probe. Verifies our two upstreams are reachable."""
    walrus_ok = False
    sui_ok = False
    sui_checkpoint = None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{walrus.publisher_url}/v1/api")
            walrus_ok = r.status_code in (200, 404)  # both indicate reachable
    except Exception:
        pass
    try:
        sui_checkpoint = await sui.latest_checkpoint()
        sui_ok = True
    except Exception:
        pass

    return {
        "ok": walrus_ok and sui_ok,
        "walrus": walrus_ok,
        "sui": sui_ok,
        "sui_checkpoint": sui_checkpoint,
        "package_id": PACKAGE_ID or None,
        "ts": int(time.time()),
    }


@app.post("/api/intel/upload", response_model=IntelUploadResponse)
async def upload_intel(req: IntelUploadRequest) -> IntelUploadResponse:
    """Wrap the structured intel with metadata + upload to Walrus.
    Returns the blob_id which the client uses when calling submit_intel(...) on Sui."""
    enriched = {
        "version": 1,
        "system_id": req.system_id,
        "intel_type": req.intel_type,
        "threat_level": req.threat_level,
        "summary": req.summary,
        "submitted_at_ms": int(time.time() * 1000),
        "payload": req.payload,
    }
    try:
        result = await walrus.write_json(enriched)
    except WalrusError as exc:
        raise HTTPException(status_code=502, detail=f"Walrus upload failed: {exc}")

    return IntelUploadResponse(
        blob_id=result.blob_id,
        aggregator_url=walrus.public_url(result.blob_id),
        size_bytes=result.size,
        walrus_cost=result.cost,
        end_epoch=result.end_epoch,
        already_certified=result.already_certified,
    )


@app.get("/api/intel/feed")
async def get_intel_feed(limit: int = 50, system_id: str | None = None) -> dict[str, Any]:
    """Return recent intel records from local cache (populated by indexer)."""
    if limit > 200:
        limit = 200
    records = db_recent_intel(limit=limit, system_id=system_id)
    return {"count": len(records), "records": records}


@app.get("/api/intel/blob/{blob_id}")
async def fetch_blob(blob_id: str) -> Response:
    """Read-through cache for Walrus blobs. Frontend can hit this if direct aggregator
    is slow/CORS-blocked, but for max speed the frontend should use walrus.public_url()
    directly."""
    try:
        raw = await walrus.read_blob(blob_id)
    except WalrusError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    try:
        # Try JSON; fall through to raw bytes
        parsed = json.loads(raw.decode("utf-8"))
        return JSONResponse(content=parsed)
    except Exception:
        return Response(content=raw, media_type="application/octet-stream")


@app.websocket("/ws/intel")
async def ws_intel(ws: WebSocket) -> None:
    """Live intel stream. Pushes IntelSubmitted events as the indexer sees them."""
    await ws_manager.connect(ws)
    try:
        await ws.send_text(json.dumps({"kind": "hello", "ts": int(time.time())}))
        while True:
            # Keep alive; we mostly broadcast. If client sends anything we ignore it.
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
