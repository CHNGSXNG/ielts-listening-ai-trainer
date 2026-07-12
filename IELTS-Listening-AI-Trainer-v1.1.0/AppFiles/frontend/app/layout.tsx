import type { Metadata } from "next";
import "./globals.css";
import TopNavigation from "../components/TopNavigation";
import PracticeStatusLights from "../components/PracticeStatusLights";
import { PracticeStoreProvider } from "../lib/practiceStore";
import { UserPreferencesProvider } from "../lib/userPreferences";
import ServiceWorkerRegistrar from "../components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "IELTS Listening AI Trainer",
  description: "Local-first IELTS listening practice, scoring, and analysis",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "IELTS Trainer", statusBarStyle: "black-translucent" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UserPreferencesProvider>
          <PracticeStoreProvider>
          <ServiceWorkerRegistrar />
          <div className="app-toolbar fixed left-0 right-0 top-0 z-40 px-2.5 py-2 sm:px-5">
            <div className="app-header-surface mx-auto flex h-16 max-w-[1840px] items-center gap-3 px-2.5 sm:px-4">
              <TopNavigation />
              <PracticeStatusLights />
            </div>
          </div>
          <main className="app-main mx-auto min-h-screen max-w-[1840px] px-4 pb-10 pt-24 sm:px-9 sm:pt-24">{children}</main>
          <footer className="app-footer mx-auto max-w-[1840px] px-5 pb-8 text-center text-xs font-semibold tracking-wide text-white/72 sm:px-9">
            IELTS Listening Made by CHNGSXNG
          </footer>
          </PracticeStoreProvider>
        </UserPreferencesProvider>
      </body>
    </html>
  );
}
