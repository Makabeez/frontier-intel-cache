// Single source of truth for constants and small helpers.

export const API_URL = import.meta.env.VITE_API_URL || "";
export const WS_URL = (() => {
  // Use the same origin (proxy in dev). In production set VITE_API_URL explicitly.
  if (typeof window === "undefined") return "";
  const apiBase = API_URL || window.location.origin;
  return apiBase.replace(/^http/, "ws") + "/ws/intel";
})();

export const WALRUS_AGGREGATOR =
  import.meta.env.VITE_WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space";

export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || "";
export const BEACON_ID = import.meta.env.VITE_BEACON_ID || "";
export const SUI_NETWORK = import.meta.env.VITE_SUI_NETWORK || "testnet";

export const SUI_EXPLORER = `https://suiscan.xyz/${SUI_NETWORK}`;

// ----- threat levels -----
export const THREAT_LEVELS = {
  1: { label: "LOW", className: "threat-1" },
  2: { label: "MED", className: "threat-2" },
  3: { label: "HIGH", className: "threat-3" },
  4: { label: "CRIT", className: "threat-4" },
};

export const INTEL_TYPES = [
  "scout_report",
  "kill_report",
  "threat_alert",
  "structure_report",
  "trade_sighting",
  "fleet_movement",
];

// ----- formatting helpers -----

/** Shorten a 0x... hash to "0xabcd…1234" */
export function shortHash(s, head = 6, tail = 4) {
  if (!s) return "";
  if (s.length <= head + tail + 2) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Shorten a Walrus blob_id (base64ish, no 0x prefix) */
export function shortBlobId(s, head = 8, tail = 6) {
  if (!s) return "";
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Format unix-ms to compact relative time: "2m ago", "1h ago", "Yesterday 14:32" */
export function relTime(ms) {
  if (!ms) return "";
  const now = Date.now();
  const diff = Math.max(0, now - Number(ms));
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  // older — show ISO date
  const dt = new Date(Number(ms));
  return dt.toISOString().slice(0, 16).replace("T", " ");
}

/** Format unix-ms to absolute UTC compact: "2026-05-27 14:32:01Z" */
export function absTime(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return d.toISOString().slice(0, 19).replace("T", " ") + "Z";
}

/** Copy to clipboard with a graceful fallback. Returns boolean success. */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

/** Build a Walrus aggregator URL for a blob_id */
export function walrusUrl(blobId) {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}

/** Build a suiscan URL for tx/object */
export function explorerTx(digest) { return `${SUI_EXPLORER}/tx/${digest}`; }
export function explorerObject(id) { return `${SUI_EXPLORER}/object/${id}`; }
export function explorerAddress(addr) { return `${SUI_EXPLORER}/account/${addr}`; }
