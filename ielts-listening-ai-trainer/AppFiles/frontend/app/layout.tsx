import type { Metadata } from "next";
import "./globals.css";
import TopNavigation from "../components/TopNavigation";
import PracticeStatusLights from "../components/PracticeStatusLights";
import { PracticeStoreProvider } from "../lib/practiceStore";

export const metadata: Metadata = {
  title: "IELTS Listening AI Trainer",
  description: "Local-first IELTS listening practice, scoring, and analysis"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PracticeStoreProvider>
          <div className="fixed left-0 right-0 top-0 z-40 px-5 py-8 sm:px-9">
            <div className="mx-auto flex max-w-[1840px] items-start justify-between gap-6">
              <TopNavigation />
              <PracticeStatusLights />
            </div>
          </div>
          <main className="mx-auto min-h-screen max-w-[1840px] px-5 pb-10 pt-44 sm:px-9">{children}</main>
          <footer className="mx-auto max-w-[1840px] px-5 pb-8 text-center text-xs font-semibold tracking-wide text-white/72 sm:px-9">
            IELTS Listening Made by CHNGSXNG
          </footer>
        </PracticeStoreProvider>
      </body>
    </html>
  );
}
