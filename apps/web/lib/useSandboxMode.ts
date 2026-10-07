"use client";

import { useEffect, useState } from "react";

const KEY = "zc_sandbox_mode";

/**
 * A per-browser preference for which network new API keys and payment links
 * default to:
 *
 * - Sandbox: Arc Testnet
 * - Production: Arc Mainnet
 *
 * Defaults to Sandbox so merchants don't accidentally create live keys or
 * payment links.
 *
 * This is only a UI default. Changing it does not modify anything that has
 * already been created. Each API key/payment link keeps the network it was
 * created for.
 *
 * The third tuple value, `ready`, is false until the stored preference has
 * been read. Gate actions on it so nothing runs against the initial
 * Sandbox default before localStorage has loaded.
 */
export function useSandboxMode(): [boolean, (v: boolean) => void, boolean] {
  const [sandbox, setSandboxState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);

      if (stored !== null) {
        setSandboxState(stored === "true");
      }
    } catch {
      // localStorage unavailable — stay on Sandbox.
    }

    setReady(true);
  }, []);

  function setSandbox(v: boolean) {
    setSandboxState(v);

    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      // Best-effort only.
    }
  }

  return [sandbox, setSandbox, ready];
}
