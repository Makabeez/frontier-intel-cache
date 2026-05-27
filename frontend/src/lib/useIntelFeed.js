import { useEffect, useRef, useState, useCallback } from "react";
import { API_URL, WS_URL } from "./util";

/**
 * useIntelFeed — manages the live intel data source.
 *
 * On mount:
 *   1. fetches initial feed from /api/intel/feed
 *   2. opens WS to /ws/intel for live updates
 *   3. on intel_submitted message, prepends to list, marks as "new" for 1.8s
 *   4. auto-reconnects on WS close with exponential backoff
 *
 * Returns: { records, count, connected, lastError, refetch }
 */
export function useIntelFeed({ limit = 100 } = {}) {
  const [records, setRecords] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState(null);

  // Track which records are "new" so we can flash-animate them
  const [newIds, setNewIds] = useState(new Set());

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  // ---- Initial fetch ----
  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/intel/feed?limit=${limit}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRecords(data.records || []);
      setLastError(null);
    } catch (e) {
      console.error("intel feed fetch failed:", e);
      setLastError(e.message);
    }
  }, [limit]);

  useEffect(() => { refetch(); }, [refetch]);

  // ---- WebSocket ----
  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          reconnectAttemptRef.current = 0;
        };

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.kind === "intel_submitted" && msg.event) {
              const ev = msg.event;
              const pj = ev.parsed_json || {};
              const record = {
                tx_digest: ev.tx_digest,
                event_seq: ev.event_seq,
                beacon_id: pj.beacon_id || "",
                intel_id: pj.intel_id || "",
                submitter: pj.submitter || ev.sender,
                system_id: pj.system_id || "",
                intel_type: pj.intel_type || "",
                threat_level: parseInt(pj.threat_level || 0, 10),
                walrus_blob_id: pj.walrus_blob_id || "",
                summary: pj.summary || "",
                timestamp_ms: parseInt(pj.timestamp_ms || ev.timestamp_ms || 0, 10),
              };
              // Dedupe by (tx_digest, event_seq)
              setRecords((prev) => {
                const key = `${record.tx_digest}:${record.event_seq}`;
                if (prev.some((r) => `${r.tx_digest}:${r.event_seq}` === key)) return prev;
                return [record, ...prev].slice(0, limit);
              });
              const recordKey = `${record.tx_digest}:${record.event_seq}`;
              setNewIds((s) => new Set(s).add(recordKey));
              // Clear "new" flag after the animation
              setTimeout(() => {
                setNewIds((s) => {
                  const next = new Set(s);
                  next.delete(recordKey);
                  return next;
                });
              }, 2000);
            }
          } catch (e) {
            console.warn("ws message parse:", e);
          }
        };

        ws.onerror = () => {
          // close handler will trigger reconnect
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          const attempt = reconnectAttemptRef.current + 1;
          reconnectAttemptRef.current = attempt;
          const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
          reconnectTimerRef.current = setTimeout(connect, delay);
        };
      } catch (e) {
        console.error("ws connect failed:", e);
        setConnected(false);
      }
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return { records, count: records.length, connected, lastError, newIds, refetch };
}
