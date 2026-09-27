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
    default: "ZelaPay Checkout — Accept digital asset payments",
    template: "%s · ZelaPay Checkout",
  },
  description: "Accept digital asset payments through a single integration — checkout widget, hosted page, payment links, API and SDK. Customers pay with the ZelaPay App or other supported wallets; settles in USDC on Arc.",
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
