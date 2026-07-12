"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";

export default function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/28 p-4 backdrop-blur-sm">
      <section className="glass w-full max-w-lg rounded-[20px] p-5" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>
          <button aria-label={t("Close")} className="rounded-full p-2 hover:bg-white/60" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
