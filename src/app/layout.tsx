import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContentDesk | AI search coverage for lean teams",
  description:
    "ContentDesk monitors the prompts and sources shaping AI search, then drafts the content and updates your team needs to keep showing up.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
