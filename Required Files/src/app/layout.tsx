import type { Metadata } from "next";
import "./globals.css";
import { TrainerProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "IELTS Listening AI Trainer",
  description: "Shadowing and cloze practice for IELTS listening."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TrainerProvider>{children}</TrainerProvider>
      </body>
    </html>
  );
}
