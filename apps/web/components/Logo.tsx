import Image from "next/image";

/**
 * The site wordmark: the bolt mark plus "ZelaPay Checkout" text. Kept in
 * its own component so header, dashboard sidebar and auth pages stay in
 * sync. The mark keeps its own color even on an otherwise monochrome site —
 * same exception as the coin logo.
 *
 * ZelaPay is the ecosystem brand; Checkout is the business-facing product
 * (the ZelaPay App is the consumer one, on zelapay.xyz). The " Checkout"
 * suffix is the product tag that keeps the two from being confused.
 *
 * `tagline` (default true) shows the " Checkout" suffix.
 */
export function Logo({ size = 22, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <>
      <span className="logo-mark">
        <Image src="/brand/zela-bolt.png" alt="" width={size} height={size} priority style={{ width: size, height: size }} />
      </span>
      ZelaPay{tagline && <span> Checkout</span>}
    </>
  );
}
