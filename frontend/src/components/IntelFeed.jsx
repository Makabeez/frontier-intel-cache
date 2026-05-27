import { useState, useMemo } from "react";
import {
  shortBlobId,
  shortHash,
  relTime,
  explorerTx,
  walrusUrl,
} from "../lib/util";
import CopyHash from "./CopyHash";
import ThreatPill from "./ThreatPill";
import IntelDetail from "./IntelDetail";

export default function IntelFeed({ records, newIds, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [filterThreat, setFilterThreat] = useState(null);
  const [filterType, setFilterType] = useState(null);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterThreat != null && r.threat_level !== filterThreat) return false;
      if (filterType && r.intel_type !== filterType) return false;
      return true;
    });
  }, [records, filterThreat, filterType]);

  const allTypes = useMemo(() => {
    const s = new Set(records.map((r) => r.intel_type).filter(Boolean));
    return Array.from(s);
  }, [records]);

  return (
    <div className="panel">
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-4 text-[11px]">
        <span className="section-label">Intel Feed</span>
        <span className="text-fg-mute">
          {filtered.length} / {records.length} records
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Threat filter */}
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((lv) => (
              <button
                key={lv}
                onClick={() => setFilterThreat(filterThreat === lv ? null : lv)}
                className={`threat-pill threat-${lv} ${filterThreat === lv ? "" : "opacity-40 hover:opacity-100"}`}
              >
                {["LOW", "MED", "HIGH", "CRIT"][lv - 1]}
              </button>
            ))}
          </div>

          {/* Type filter */}
          {allTypes.length > 0 && (
            <select
              value={filterType || ""}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="bg-bg border border-border text-fg-dim font-mono text-[11px] py-1 px-2 focus:border-accent focus:outline-none"
            >
              <option value="">all types</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          <button onClick={onRefresh} className="btn !py-1 !px-3" title="refetch">
            ↻
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[88px_84px_90px_1fr_140px_120px_90px] gap-3 px-4 py-2 border-b border-border text-fg-mute text-[10px] uppercase tracking-[0.16em]">
        <div>Time</div>
        <div>Threat</div>
        <div>System</div>
        <div>Summary</div>
        <div>Blob (Walrus)</div>
        <div>Submitter</div>
        <div>Tx</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {filtered.length === 0 ? (
          <EmptyState records={records.length} />
        ) : (
          filtered.map((r) => {
            const key = `${r.tx_digest}:${r.event_seq}`;
            const isNew = newIds && newIds.has(key);
            return (
              <Row
                key={key}
                record={r}
                isNew={isNew}
                onClick={() => setSelected(r)}
              />
            );
          })
        )}
      </div>

      {selected && <IntelDetail record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Row({ record, isNew, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full grid grid-cols-[88px_84px_90px_1fr_140px_120px_90px] gap-3 px-4 py-2.5
                  text-left text-[12px] items-baseline hover:bg-bg-hover transition-colors
                  ${isNew ? "row-new" : ""}`}
    >
      <span className="text-fg-mute" title={new Date(record.timestamp_ms).toISOString()}>
        {relTime(record.timestamp_ms)}
      </span>
      <span><ThreatPill level={record.threat_level} /></span>
      <span className="text-fg-dim tabular-nums">{record.system_id || "—"}</span>
      <span className="text-fg truncate" title={record.summary}>
        {record.summary || <span className="text-fg-mute italic">(no summary)</span>}
      </span>
      <span onClick={(e) => e.stopPropagation()} className="text-fg-dim">
        <CopyHash
          value={record.walrus_blob_id}
          display={shortBlobId(record.walrus_blob_id)}
          title="walrus blob_id"
          href={walrusUrl(record.walrus_blob_id)}
        />
      </span>
      <span onClick={(e) => e.stopPropagation()} className="text-fg-dim">
        <CopyHash
          value={record.submitter}
          display={shortHash(record.submitter, 6, 4)}
          title="submitter"
        />
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <CopyHash
          value={record.tx_digest}
          display={shortHash(record.tx_digest, 5, 3)}
          title="sui tx digest"
          href={explorerTx(record.tx_digest)}
        />
      </span>
    </button>
  );
}

function EmptyState({ records }) {
  return (
    <div className="px-4 py-16 text-center">
      <div className="text-fg-mute text-[11px] uppercase tracking-[0.2em]">
        {records === 0 ? "no intel filed yet" : "no records match the filter"}
      </div>
      <div className="text-fg-mute text-[11px] mt-2">
        {records === 0
          ? "use the submit form on the right to file the first report"
          : "clear filters above to see all"}
      </div>
    </div>
  );
}
