import { ConnectButton } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { API_URL, BEACON_ID, PACKAGE_ID, explorerObject, shortHash } from "../lib/util";
import CopyHash from "./CopyHash";

export default function Header({ connected, count }) {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/api/health`);
      if (!r.ok) throw new Error("health failed");
      return r.json();
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const ok = health?.ok;
  const sui = health?.sui;
  const walrus = health?.walrus;

  return (
    <header className="border-b border-border bg-bg-elev relative z-10">
      <div className="px-5 py-3 flex items-center gap-6">
        {/* Sigil + product name */}
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-accent rotate-45" />
          <div>
            <div className="text-fg font-bold text-[15px] tracking-[0.05em] cursor-blink">
              FRONTIER ▒ INTEL CACHE
            </div>
            <div className="text-fg-mute text-[10px] tracking-[0.18em] uppercase">
              on-chain proof · off-chain payload
            </div>
          </div>
        </div>

        {/* Center: system status strip */}
        <div className="hidden md:flex items-center gap-5 ml-6 text-[11px]">
          <StatusBlock label="SUI" ok={sui} value={health?.sui_checkpoint ? `cp ${health.sui_checkpoint}` : "..."} />
          <StatusBlock label="WALRUS" ok={walrus} value={walrus ? "online" : "..."} />
          <StatusBlock label="STREAM" ok={connected} value={connected ? "live" : "offline"} live={connected} />
          <StatusBlock label="INTEL" ok value={`${count} rec`} />
        </div>

        {/* Right: beacon + wallet */}
        <div className="ml-auto flex items-center gap-5">
          <div className="hidden lg:flex flex-col items-end leading-tight">
            <span className="section-label">Active beacon</span>
            <CopyHash
              value={BEACON_ID}
              display={shortHash(BEACON_ID, 8, 6)}
              title="beacon id"
              href={explorerObject(BEACON_ID)}
            />
          </div>
          <ConnectButton
            className="!font-mono !uppercase !tracking-[0.15em] !text-[11px] !font-medium !border !border-border-strong !bg-bg-elev !text-fg !px-4 !py-2 hover:!bg-bg-hover hover:!border-accent hover:!text-accent !rounded-none"
          />
        </div>
      </div>
    </header>
  );
}

function StatusBlock({ label, ok, value, live }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="section-label">{label}</span>
      <span className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 ${ok ? "bg-ok" : "bg-bad"} ${live ? "live-dot" : ""}`}
        />
        <span className={ok ? "text-fg" : "text-fg-mute"}>{value}</span>
      </span>
    </div>
  );
}
