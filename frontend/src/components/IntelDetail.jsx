import { useEffect, useState } from "react";
import {
  walrusUrl,
  explorerTx,
  explorerObject,
  shortBlobId,
  shortHash,
  absTime,
} from "../lib/util";
import CopyHash from "./CopyHash";
import ThreatPill from "./ThreatPill";

export default function IntelDetail({ record, onClose }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPayload(null);

    fetch(walrusUrl(record.walrus_blob_id))
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch {
          // Not JSON — return as raw text
          return { __raw: text };
        }
      })
      .then((data) => {
        if (!cancelled) {
          setPayload(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [record.walrus_blob_id]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg/85 backdrop-blur-sm p-4 sm:p-10 overflow-auto"
      onClick={onClose}
    >
      <div
        className="panel-strong w-full max-w-4xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="border-b border-border-strong px-5 py-3 flex items-center gap-4">
          <ThreatPill level={record.threat_level} />
          <div>
            <div className="text-fg text-[13px] font-medium">
              {record.intel_type || "intel_record"}
            </div>
            <div className="text-fg-mute text-[10px] uppercase tracking-[0.15em]">
              system {record.system_id || "—"} · {absTime(record.timestamp_ms)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-fg-mute hover:text-accent text-[13px] tracking-[0.2em] uppercase"
          >
            ✕ close
          </button>
        </div>

        {/* Summary */}
        {record.summary && (
          <div className="px-5 py-4 border-b border-border">
            <div className="section-label mb-1">Summary</div>
            <div className="text-fg text-[14px] leading-snug">{record.summary}</div>
          </div>
        )}

        {/* Two-column reference panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
          <RefCell label="Walrus blob" mono>
            <CopyHash
              value={record.walrus_blob_id}
              display={shortBlobId(record.walrus_blob_id, 14, 10)}
              title="walrus blob_id"
              href={walrusUrl(record.walrus_blob_id)}
            />
          </RefCell>
          <RefCell label="Sui tx digest" mono>
            <CopyHash
              value={record.tx_digest}
              display={shortHash(record.tx_digest, 10, 6)}
              title="sui tx digest"
              href={explorerTx(record.tx_digest)}
            />
          </RefCell>
          <RefCell label="IntelRecord object" mono>
            <CopyHash
              value={record.intel_id}
              display={shortHash(record.intel_id, 10, 6)}
              title="intel record object id"
              href={explorerObject(record.intel_id)}
            />
          </RefCell>
          <RefCell label="Submitter" mono>
            <CopyHash
              value={record.submitter}
              display={shortHash(record.submitter, 10, 6)}
              title="submitter address"
            />
          </RefCell>
        </div>

        {/* Walrus payload */}
        <div className="border-t border-border-strong">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="section-label">Walrus payload</div>
              <div className="text-fg-mute text-[10px] mt-0.5">
                fetched live from {walrusUrl(record.walrus_blob_id)}
              </div>
            </div>
            <a
              href={walrusUrl(record.walrus_blob_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn !py-1 !px-3"
            >
              Open raw ↗
            </a>
          </div>

          <div className="px-5 py-4 bg-bg max-h-[55vh] overflow-auto">
            {loading && (
              <div className="text-fg-mute text-[12px] tracking-[0.1em]">
                fetching from walrus aggregator<span className="cursor-blink" />
              </div>
            )}
            {error && (
              <div className="text-bad text-[12px]">
                payload fetch failed: {error}
              </div>
            )}
            {payload && (
              <pre className="text-fg text-[12px] leading-[1.55] whitespace-pre-wrap break-words">
                {payload.__raw
                  ? payload.__raw
                  : JSON.stringify(payload, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RefCell({ label, children }) {
  return (
    <div className="bg-bg-elev px-5 py-3">
      <div className="section-label mb-1">{label}</div>
      <div className="text-fg-dim">{children}</div>
    </div>
  );
}
