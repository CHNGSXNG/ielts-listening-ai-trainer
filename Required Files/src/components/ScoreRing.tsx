export function ScoreRing({ score, label }: { score: number; label: string }) {
  const normalized = Math.max(0, Math.min(100, score));
  return (
    <div className="relative grid h-44 w-44 place-items-center rounded-full bg-white/35 shadow-inner">
      <div
        className="absolute inset-3 rounded-full"
        style={{
          background: `conic-gradient(#4f8cff ${normalized * 3.6}deg, rgba(148, 163, 184, 0.22) 0deg)`
        }}
      />
      <div className="relative grid h-32 w-32 place-items-center rounded-full bg-white/80 text-center shadow-glass backdrop-blur-xl">
        <div>
          <div className="text-4xl font-semibold">{normalized}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
