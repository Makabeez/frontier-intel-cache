import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  API_URL,
  PACKAGE_ID,
  BEACON_ID,
  INTEL_TYPES,
  explorerTx,
  walrusUrl,
  shortHash,
  shortBlobId,
} from "../lib/util";
import CopyHash from "./CopyHash";

const CLOCK_OBJECT_ID = "0x6"; // Sui canonical clock — same on every chain

const SAMPLE = {
  system_id: "30000142",
  system_name: "Jita",
  intel_type: "scout_report",
  threat_level: 3,
  summary: "Roaming gang at outbound gate",
  notes: "Heavy logi support. Recommend reroute via Perimeter.",
  observed_ships: "battleship:3, logistics:2, interceptor:4",
};

/**
 * Two-step submission:
 *   1. POST /api/intel/upload  → backend wraps + uploads to Walrus, returns blob_id
 *   2. Construct + sign Sui tx calling intel_beacon::submit_intel(...) with the blob_id
 */
export default function IntelForm({ onSubmitted }) {
  const [form, setForm] = useState({ ...SAMPLE });
  const [step, setStep] = useState("idle"); // idle | uploading | signing | success | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { blobId, txDigest }

  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!account) {
      setError("Connect a wallet first (top right).");
      return;
    }
    if (!PACKAGE_ID || !BEACON_ID) {
      setError("Missing PACKAGE_ID or BEACON_ID in .env");
      return;
    }

    // --- Step 1: upload payload to Walrus via backend ---
    setStep("uploading");
    let blobId, walrusEndEpoch, walrusCost;
    try {
      const enriched = {
        system_name: form.system_name,
        notes: form.notes,
        observed_ships: parseObservedShips(form.observed_ships),
        client: "frontier-intel-cache-web",
      };
      const r = await fetch(`${API_URL}/api/intel/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_id: form.system_id,
          intel_type: form.intel_type,
          threat_level: Number(form.threat_level),
          summary: form.summary,
          payload: enriched,
        }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Walrus upload failed: ${r.status} ${text.slice(0, 200)}`);
      }
      const data = await r.json();
      blobId = data.blob_id;
      walrusEndEpoch = data.end_epoch;
      walrusCost = data.walrus_cost;
    } catch (err) {
      setStep("error");
      setError(err.message);
      return;
    }

    // --- Step 2: build + sign submit_intel(...) tx ---
    setStep("signing");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::intel_beacon::submit_intel`,
        arguments: [
          tx.object(BEACON_ID),
          tx.pure.string(form.system_id),
          tx.pure.string(form.intel_type),
          tx.pure.u8(Number(form.threat_level)),
          tx.pure.string(blobId),
          tx.pure.string(form.summary),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      const exec = await signAndExecute({
        transaction: tx,
        options: { showEffects: true, showEvents: true },
      });
      const txDigest = exec?.digest;
      setResult({ blobId, txDigest, walrusEndEpoch, walrusCost });
      setStep("success");
      onSubmitted?.({ blobId, txDigest });
    } catch (err) {
      setStep("error");
      setError(err.message || String(err));
    }
  }

  function reset() {
    setStep("idle");
    setResult(null);
    setError(null);
    setForm({ ...SAMPLE });
  }

  // ---- Success view ----
  if (step === "success" && result) {
    return (
      <div className="panel">
        <div className="px-4 py-3 border-b border-border">
          <div className="section-label">Intel filed</div>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="text-ok text-[12px] uppercase tracking-[0.18em]">
            ✓ on-chain + on-walrus
          </div>
          <div className="space-y-2 text-[12px]">
            <div>
              <span className="section-label block mb-1">Walrus blob</span>
              <CopyHash
                value={result.blobId}
                display={shortBlobId(result.blobId, 14, 10)}
                href={walrusUrl(result.blobId)}
              />
            </div>
            {result.txDigest && (
              <div>
                <span className="section-label block mb-1">Sui tx</span>
                <CopyHash
                  value={result.txDigest}
                  display={shortHash(result.txDigest, 12, 6)}
                  href={explorerTx(result.txDigest)}
                />
              </div>
            )}
          </div>
          <button onClick={reset} className="btn-primary w-full !mt-4">
            File another report
          </button>
        </div>
      </div>
    );
  }

  // ---- Form view ----
  return (
    <form onSubmit={handleSubmit} className="panel">
      <div className="px-4 py-3 border-b border-border flex items-center">
        <span className="section-label">File Intel Report</span>
        <span className="ml-auto text-fg-mute text-[10px] uppercase tracking-[0.18em]">
          → Walrus → Sui
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        <Field label="System ID" hint="any identifier (e.g. EVE system 30000142)">
          <input
            className="input"
            required
            value={form.system_id}
            onChange={(e) => set("system_id", e.target.value)}
          />
        </Field>

        <Field label="System name (optional)">
          <input
            className="input"
            value={form.system_name}
            onChange={(e) => set("system_name", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Intel type">
            <select
              className="input"
              value={form.intel_type}
              onChange={(e) => set("intel_type", e.target.value)}
            >
              {INTEL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Threat level">
            <select
              className="input"
              value={form.threat_level}
              onChange={(e) => set("threat_level", Number(e.target.value))}
            >
              <option value={1}>1 — LOW</option>
              <option value={2}>2 — MED</option>
              <option value={3}>3 — HIGH</option>
              <option value={4}>4 — CRIT</option>
            </select>
          </Field>
        </div>

        <Field label="Summary" hint="≤ 200 chars, shown in the feed">
          <input
            className="input"
            required
            maxLength={200}
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </Field>

        <Field label="Notes" hint="full details, stored on Walrus, not on Sui">
          <textarea
            className="input min-h-[64px] resize-y"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        <Field label="Observed ships" hint="format: class:count, class:count, …">
          <input
            className="input"
            value={form.observed_ships}
            onChange={(e) => set("observed_ships", e.target.value)}
          />
        </Field>

        {/* Errors */}
        {step === "error" && error && (
          <div className="border border-bad text-bad px-3 py-2 text-[11px]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={step === "uploading" || step === "signing" || !account}
          className="btn-primary w-full"
        >
          {step === "uploading" && "uploading to walrus…"}
          {step === "signing" && "sign in wallet…"}
          {(step === "idle" || step === "error") && (account ? "Submit intel report" : "Connect wallet first")}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="section-label block mb-1">{label}</span>
      {children}
      {hint && <span className="text-fg-mute text-[10px] block mt-0.5">{hint}</span>}
    </label>
  );
}

function parseObservedShips(s) {
  if (!s) return [];
  return s
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [klass, count] = part.split(":").map((x) => x?.trim());
      return { class: klass || "unknown", count: parseInt(count || "1", 10) || 1 };
    });
}
