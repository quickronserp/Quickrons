import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quickrons Ops',
  description: 'Live operations console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white">
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-bold">Q</div>
                <div>
                  <div className="font-bold text-base">Quickrons Ops</div>
                  <div className="text-xs text-slate-500">Perinthalmanna · Live</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-500">Shakeeb Ali</span>
                <span className="px-2 py-1 rounded-full bg-ok/10 text-ok text-xs font-bold">ADMIN</span>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
