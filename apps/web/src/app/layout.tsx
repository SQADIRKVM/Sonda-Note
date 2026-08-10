import type { Metadata, Viewport } from "next";
import { Bitter, Schibsted_Grotesk, JetBrains_Mono, Noto_Sans_Malayalam } from "next/font/google";
import { MotionConfig } from "framer-motion";
import { SmoothScroll } from "./_motion/smooth-scroll";

import "./globals.css";

const fontSlab = Bitter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-slab",
  display: "swap",
});

const fontUi = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const fontMl = Noto_Sans_Malayalam({
  subsets: ["malayalam"],
  weight: ["400", "500"],
  variable: "--font-ml",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sonda Note — Your Conversational Knowledge Engine",
  description:
    "Turn every meeting into structured, searchable knowledge. Transcribes Malayalam + English code-mixed meetings in real time, auto-corrects company jargon, and delivers grounded insights.",
  applicationName: "Sonda Note",
};

export const viewport: Viewport = {
  themeColor: "#F7F4EE",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fontSlab.variable} ${fontUi.variable} ${fontMono.variable} ${fontMl.variable}`}
    >
      <body className="bg-sn-canvas text-sn-ink antialiased font-sans">
        <SmoothScroll />
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
