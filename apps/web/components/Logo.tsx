import Image from "next/image";

/**
 * The site wordmark: the bolt mark plus "Zela Payment Rails" text. Kept in
 * its own component so header, dashboard sidebar and auth pages stay in
 * sync. The mark keeps its own color even on an otherwise monochrome site —
 * same exception as the coin logo.
 *
 * "Zela Payment Rails" is the platform brand; "Checkout" is the first
 * product built on it (see app/page.tsx) — this wordmark is the platform's,
 * used everywhere, not swapped per-product.
 *
 * `tagline` (default true) shows the " Payment Rails" suffix — off in the
 * top nav specifically (SiteHeader passes false), where the compact pill
 * has less room and "Zela" alone reads cleanly; dashboard sidebar and auth
 * pages keep the full name.
 */
export function Logo({ size = 22, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <>
      <span className="logo-mark">
        <Image src="/brand/zela-bolt.png" alt="" width={size} height={size} priority style={{ width: size, height: size }} />
      </span>
      Zela{tagline && <span> Payment Rails</span>}
    </>
  );
}
