import Image from "next/image";

/**
 * A real pre-rendered 3D USDC coin (proper thickness/bevel from the source
 * render, not simulated in CSS). Floats gently in place — no spin. Purely
 * decorative, so it's aria-hidden; the surrounding hero copy carries the
 * actual message.
 */
export function Coin3D() {
  return (
    <div className="coin-float-wrap" aria-hidden="true">
      <div className="coin-float">
        <Image src="/brand/usdc-coin-3d.webp" alt="" width={420} height={420} priority className="coin-img" />
      </div>
      <div className="coin-shadow" />
    </div>
  );
}
