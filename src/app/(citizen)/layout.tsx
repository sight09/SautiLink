import type { ReactNode } from "react";
import { CitizenHeader, CitizenNav } from "@/components/app-shell";

export default function CitizenLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <CitizenHeader />
      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-5">
        {children}
      </main>
      <CitizenNav />
    </div>
  );
}
