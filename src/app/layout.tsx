import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppProvider } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SautiLink — Speak safely. Track change.",
    template: "%s · SautiLink",
  },
  description:
    "SautiLink is an offline-capable, privacy-conscious civic platform for safely reporting public-service and safety problems, communicating anonymously with institutions, and tracking cases to resolution.",
  manifest: "/manifest.webmanifest",
  applicationName: "SautiLink",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SautiLink" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e5951",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-lite="off">
      <body className="bg-sand-50 text-ink-900 antialiased">
        <a href="#main" className="sl-skip-link">
          Skip to main content
        </a>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
