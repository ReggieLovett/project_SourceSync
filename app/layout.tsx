import type { Metadata } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Self-hosted by next/font; app/globals.css reads them through these CSS variables.
// Zen Kaku Gothic New is the interface voice; Shippori Mincho sets source text and evidence.
// Both are Japanese fonts split into hundreds of unicode-range slices. preload: false
// lets the browser fetch only the slices the page's text uses (a few Latin files)
// instead of preloading every slice (about 240 files, 2.8 MB).
const sans = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
  variable: "--font-sans",
});

const serif = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
  preload: false,
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Source Sync",
  description: "Source Sync checks AI answers claim by claim against their source documents, with the exact quote as proof.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
