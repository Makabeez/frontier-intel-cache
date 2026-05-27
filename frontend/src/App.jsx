import { useIntelFeed } from "./lib/useIntelFeed";
import Header from "./components/Header";
import IntelFeed from "./components/IntelFeed";
import IntelForm from "./components/IntelForm";
import StatsPanel from "./components/StatsPanel";

export default function App() {
  const { records, connected, refetch, newIds } = useIntelFeed({ limit: 200 });

  return (
    <div className="min-h-screen flex flex-col relative">
      <Header connected={connected} count={records.length} />

      <main className="flex-1 px-5 py-5 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 relative z-10">
        <section className="space-y-5 min-w-0">
          <IntelFeed records={records} newIds={newIds} onRefresh={refetch} />
        </section>

        <aside className="space-y-5">
          <IntelForm onSubmitted={() => refetch()} />
          <StatsPanel records={records} />
        </aside>
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-bg-elev px-5 py-3 text-[10px] text-fg-mute tracking-[0.15em] uppercase flex items-center gap-4 relative z-10">
      <span>frontier intel cache · v0.1.0</span>
      <span className="text-border-strong">▒</span>
      <span>tatum × walrus hackathon · may 2026</span>
      <span className="ml-auto">
        <a
          href="https://github.com/Makabeez/frontier-intel-cache"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent"
        >
          github.com/makabeez/frontier-intel-cache ↗
        </a>
      </span>
    </footer>
  );
}
