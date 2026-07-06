"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Upload" },
  { href: "/practice", label: "Practise" },
  { href: "/analysis", label: "Analysis" },
  { href: "/settings", label: "Settings" }
];

export default function TopNavigation() {
  const pathname = usePathname();
  return (
    <header className="flex min-w-0 flex-1 items-center">
      <nav className="flex items-center rounded-[22px] border border-white/70 bg-[#f5f7fb]/95 p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-3xl">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[18px] px-5 py-2.5 text-lg font-semibold text-slate-950 transition ${
                active ? "bg-white shadow-[0_8px_18px_rgba(15,23,42,0.14)]" : "hover:bg-white/70"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
