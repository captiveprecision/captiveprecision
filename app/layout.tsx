import type { Metadata } from "next";
import "./globals.css";
import "./dashboard-overrides.css";

export const metadata: Metadata = {
  title: "Captive Precision Platform",
  description: "Premium platform for cheer tools."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
