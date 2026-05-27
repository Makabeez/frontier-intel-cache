import { useMemo } from "react";
import { THREAT_LEVELS } from "../lib/util";

export default function StatsPanel({ records }) {
  const stats = useMemo(() => {
    const byThreat = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const byType = {};
    const bySystem = {};
    const submitters = new Set();
    let walrusTotal = 0;
    for (const r of records) {
      byThreat[r.threat_level] = (byThreat[r.threat_level] || 0) + 1;
      if (r.intel_type) byType[r.intel_type] = (byType[r.intel_type] || 0) + 1;
      if (r.system_id) bySystem[r.system_id] = (bySystem[r.system_id] || 0) + 1;
      if (r.submitter) submitters.add(r.submitter);
      walrusTotal += 1;
    }
    const topSystems = Object.entries(bySystem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { byThreat, topSystems, topTypes, submitters: submitters.size, walrusTotal };
  }, [records]);

  return (
    <div className="panel">
      <div className="px-4 py-3 border-b border-border">
        <span className="section-label">Intel Stats</span>
      </div>

      {/* Threat breakdown */}
      <div className="px-4 py-3 border-b border-border">
        <div className="section-label mb-2">By threat level</div>
        <div className="space-y-1.5">
          {[4, 3, 2, 1].map((lv) => {
            const c = stats.byThreat[lv] || 0;
            const total = records.length || 1;
            const pct = (c / total) * 100;
            const t = THREAT_LEVELS[lv];
            return (
              <div key={lv} className="flex items-center gap-2 text-[11px]">
                <span className={`w-12 ${t.className}`}>{t.label}</span>
                <div className="flex-1 h-3 bg-bg border border-border overflow-hidden">
                  <div
                    className={`h-full ${t.className.replace("threat-", "bg-")}`}
                    style={{
                      width: `${pct}%`,
                      background: `var(--${lv === 1 ? "ok" : lv === 2 ? "warn" : lv === 3 ? "bad" : "crit"})`,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-fg-dim tabular-nums">{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top systems */}
      {stats.topSystems.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="section-label mb-2">Most-watched systems</div>
          <div className="space-y-1 text-[12px]">
            {stats.topSystems.map(([sys, count]) => (
              <div key={sys} className="flex items-baseline">
                <span className="text-fg-dim tabular-nums">{sys}</span>
                <span className="mx-2 flex-1 border-b border-dotted border-border" />
                <span className="text-fg tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top types */}
      {stats.topTypes.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="section-label mb-2">By intel type</div>
          <div className="space-y-1 text-[12px]">
            {stats.topTypes.map(([t, count]) => (
              <div key={t} className="flex items-baseline">
                <span className="text-fg-dim">{t}</span>
                <span className="mx-2 flex-1 border-b border-dotted border-border" />
                <span className="text-fg tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary line */}
      <div className="px-4 py-3 text-[11px] space-y-1">
        <Row label="Total records" value={records.length} />
        <Row label="Unique submitters" value={stats.submitters} />
        <Row label="Walrus blobs" value={stats.walrusTotal} />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline">
      <span className="text-fg-mute">{label}</span>
      <span className="mx-2 flex-1 border-b border-dotted border-border" />
      <span className="text-fg tabular-nums">{value}</span>
    </div>
  );
}
