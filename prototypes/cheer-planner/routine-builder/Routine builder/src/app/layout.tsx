import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routine Builder",
  description: "Prototype for planning cheerleading routines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

