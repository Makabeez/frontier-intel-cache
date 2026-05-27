import { THREAT_LEVELS } from "../lib/util";

export default function ThreatPill({ level }) {
  const t = THREAT_LEVELS[level] || THREAT_LEVELS[1];
  return (
    <span className={`threat-pill ${t.className}`}>
      <span className="opacity-70">█</span>
      {t.label}
    </span>
  );
}
