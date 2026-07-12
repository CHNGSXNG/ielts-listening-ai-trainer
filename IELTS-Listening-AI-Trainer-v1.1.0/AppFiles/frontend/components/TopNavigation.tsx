"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePracticeStore } from "../lib/practiceStore";
import { useI18n } from "../lib/i18n";

const items = [
  { href: "/", label: "Upload" },
  { href: "/practice", label: "Practise" },
  { href: "/analysis", label: "Analysis" },
  { href: "/settings", label: "Settings" }
];

export default function TopNavigation() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { currentStatus, session } = usePracticeStore();
  const navigationLocked =
    currentStatus === "UPLOADING" ||
    currentStatus === "TRANSCRIBING" ||
    currentStatus === "ALIGNING" ||
    currentStatus === "EVALUATING" ||
    currentStatus === "BACKUP_WORKING" ||
    currentStatus === "MODEL_DOWNLOADING";
  return (
    <div className="top-navigation-shell flex min-w-0 flex-1 items-center gap-4 lg:gap-7">
      <nav className="primary-navigation flex min-w-max items-center rounded-[15px] bg-slate-200/55 p-1" aria-label={t("Primary navigation")}>
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-disabled={navigationLocked && !active}
              title={navigationLocked && !active ? t("Finish the current operation before changing pages") : undefined}
              onClick={(event) => {
                if (navigationLocked && !active) event.preventDefault();
              }}
              className={`rounded-[12px] px-3 py-2 text-[15px] font-semibold text-slate-800 transition sm:px-4 ${
                active ? "nav-active bg-white/95 text-slate-950 shadow-[0_4px_12px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,1)]" : "hover:bg-white/55"
              } ${navigationLocked && !active ? "cursor-wait opacity-45" : ""}`}
            >
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
      <div className="hidden min-w-0 flex-1 text-center md:block">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {pathname === "/practice" ? t("Intensive listening") : "IELTS Listening AI Trainer"}
        </p>
        <p className="mt-0.5 truncate text-[15px] font-semibold text-slate-950">
          {pathname === "/practice" ? session.sourceName || t("Practice session") : t(items.find((item) => item.href === pathname)?.label || "Listening trainer")}
        </p>
      </div>
    </div>
  );
}
