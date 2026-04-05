import type { Metadata, Viewport } from "next";

import { PwaOfflineNotice, PwaProvider } from "@/components/pwa/pwa-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Captive Precision Platform",
  description: "Premium platform for cheer tools.",
  applicationName: "Captive Precision",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Captive Precision"
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "maskable-icon", url: "/pwa/maskable-icon-512.png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#ffc800"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaProvider>
          <PwaOfflineNotice />
          {children}
        </PwaProvider>
      </body>
    </html>
  );
}
