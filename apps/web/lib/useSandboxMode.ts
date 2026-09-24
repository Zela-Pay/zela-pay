"use client";

import { useEffect, useState } from "react";

const KEY = "zc_sandbox_mode";

/**
 * A per-browser preference (not a merchant/server setting) for which mode
 * new API keys and payment links default to — Sandbox (settles on Arc's
 * test network) or Production (settles for real). Defaults to Sandbox:
 * a merchant accidentally creating a live key/link is a much worse outcome
 * than the reverse, matching issueApiKeyPair's own server-side default.
 * Purely a UI default — changing it never touches anything already
 * created; each key/link keeps whichever mode it was made in.
 */
export function useSandboxMode(): [boolean, (v: boolean) => void] {
  const [sandbox, setSandboxState] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored !== null) setSandboxState(stored === "true");
    } catch {
      /* localStorage unavailable (private browsing, etc.) — stay on the default */
    }
  }, []);

  function setSandbox(v: boolean) {
    setSandboxState(v);
    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      /* best-effort only */
    }
  }

  return [sandbox, setSandbox];
}
