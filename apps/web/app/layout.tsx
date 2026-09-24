import type { ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";
import { Providers } from "../components/Providers";
import "./globals.css";

// Headline/display face only (body stays system-ui) — the same pairing
// zela-app's own UI already uses (SpaceGrotesk + Inter), so this product
// reads as the same brand rather than an unrelated typographic choice.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata = {
  title: {
    default: "Zela Payment Rails",
    template: "%s · Zela Payment Rails",
  },
  description: "Payment infrastructure for native USDC on Arc. Checkout is the first rail — pay with the Zela app or any EVM wallet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
