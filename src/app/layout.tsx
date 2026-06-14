import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SignalOS",
  description: "Idea → signal → MVP pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-edge sticky top-0 bg-ink/80 backdrop-blur z-10">
            <div className="max-w-5xl mx-auto px-5 h-14 flex items-center gap-6">
              <Link href="/" className="font-semibold tracking-tight">
                Signal<span className="text-accent">OS</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm text-muted">
                <Link href="/" className="hover:text-white">Ideas</Link>
                <Link href="/costs" className="hover:text-white">Costs</Link>
                <Link href="/logs" className="hover:text-white">LLM Logs</Link>
              </nav>
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-5 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
