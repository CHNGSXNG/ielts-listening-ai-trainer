"use client";

import type { RefObject } from "react";
import { Headphones } from "lucide-react";
import { useTrainer } from "@/lib/store";

export function AudioCard({ audioRef }: { audioRef?: RefObject<HTMLAudioElement> }) {
  const { audioName, audioUrl } = useTrainer();
  return (
    <div className="rounded-[18px] border border-white/60 bg-white/45 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#4f8cff]/15 text-[#2f6de6]">
          <Headphones size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{audioName}</p>
          <p className="text-xs text-slate-500">Sentence split and cloze ready</p>
        </div>
      </div>
      {audioUrl ? <audio ref={audioRef} className="mt-4 w-full" controls src={audioUrl} /> : <div className="mt-4 h-10 rounded-xl bg-white/45" />}
    </div>
  );
}
