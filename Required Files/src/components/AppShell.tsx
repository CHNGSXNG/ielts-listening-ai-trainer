"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileAudio, History, Mic2, PanelsTopLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useTrainer } from "@/lib/store";
import { ScoreRing } from "@/components/ScoreRing";

const items = [
  { href: "/", label: "Upload", icon: FileAudio },
  { href: "/shadow", label: "Shadow Mode", icon: Mic2 },
  { href: "/cloze", label: "Cloze Mode", icon: PanelsTopLeft },
  { href: "/results", label: "History", icon: History }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lastResult, transcript } = useTrainer();

  return (
    <main className="relative z-10 min-h-screen p-4 text-slate-900 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-[1500px] grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)_310px]">
        <motion.aside
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          className="glass flex rounded-[20px] p-4 lg:flex-col"
        >
          <div className="hidden pb-8 lg:block">
            <div className="mb-6 flex gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff605c]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbd44]" />
              <span className="h-3 w-3 rounded-full bg-[#00ca4e]" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">IELTS Lab</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">Listening AI Trainer</h1>
          </div>
          <nav className="grid w-full grid-cols-2 gap-2 lg:grid-cols-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`soft-button flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium ${
                    active ? "bg-white/70 text-slate-950 shadow-glow" : "text-slate-600 hover:bg-white/45"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </motion.aside>

        <motion.section
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="glass-strong min-h-[680px] rounded-[22px] p-5 md:p-8"
        >
          {children}
        </motion.section>

        <motion.aside
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          className="glass rounded-[20px] p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <BarChart3 size={18} />
            AI Feedback
          </div>
          <div className="mt-8 flex justify-center">
            <ScoreRing score={lastResult?.score ?? 0} label={lastResult ? `Band ${lastResult.band}` : "Awaiting score"} />
          </div>
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-white/60 bg-white/42 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transcript</p>
              <p className="mt-2 text-2xl font-semibold">{transcript?.sentences.length ?? 0}</p>
              <p className="text-sm text-slate-500">sentences prepared</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/42 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mistakes</p>
              <p className="mt-2 text-2xl font-semibold">{lastResult?.mistakes.length ?? 0}</p>
              <p className="text-sm text-slate-500">weighted review items</p>
            </div>
            {lastResult ? (
              <p className="rounded-2xl border border-white/60 bg-white/48 p-4 text-sm leading-6 text-slate-600">
                {lastResult.explanation}
              </p>
            ) : null}
          </div>
        </motion.aside>
      </div>
    </main>
  );
}
