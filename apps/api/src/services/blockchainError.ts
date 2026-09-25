/**
 * Turns a raw viem/RPC error into a short, human-readable sentence.
 *
 * viem's own errors already carry a `.shortMessage` that's far cleaner than
 * `.message` (which appends a full args dump, docs links, and a version
 * string — the "ContractFunctionExecutionError: ... Docs: https://viem.sh/..."
 * wall of text). Preferring `.shortMessage` alone fixes most of the noise;
 * the pattern matches below cover the handful of cases worth a friendlier,
 * merchant/customer-facing sentence instead of viem's own (still fairly
 * technical) wording.
 *
 * The raw error is always logged server-side by the caller — this function
 * only decides what's safe and clear enough to put in an API response.
 */

interface ViemLikeError {
  shortMessage?: string;
  message?: string;
  name?: string;
  cause?: unknown;
}

function asViemLike(err: unknown): ViemLikeError | null {
  if (err && typeof err === "object" && ("shortMessage" in err || "message" in err)) {
    return err as ViemLikeError;
  }
  return null;
}

/** Walks `.cause` chains — viem often wraps the actually-informative error (e.g. a revert reason) one or two levels down. */
function deepest(err: unknown, depth = 0): unknown {
  if (depth > 5) return err;
  const v = asViemLike(err);
  if (v?.cause) return deepest(v.cause, depth + 1);
  return err;
}

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /insufficient funds/i,
    message: "The account doesn't have enough USDC to cover this transfer and its network fee.",
  },
  {
    test: /user rejected/i,
    message: "The transaction was rejected in the wallet.",
  },
  {
    test: /nonce too low|nonce has already been used/i,
    message: "This transaction was already submitted. Please wait a moment and try again.",
  },
  {
    test: /(HTTP request failed|fetch failed|ECONNREFUSED|ETIMEDOUT|network.*(unavailable|error))/i,
    message: "Couldn't reach the Arc network right now. This is usually temporary — please try again shortly.",
  },
  {
    test: /timeout/i,
    message: "The network took too long to respond. The transaction may still complete — please check back shortly before retrying.",
  },
  {
    test: /execution reverted|reverted on-chain/i,
    message: "The transfer was rejected on-chain. This usually means the account's balance changed since the transfer was prepared.",
  },
  {
    test: /gas required exceeds allowance|out of gas/i,
    message: "The transaction ran out of gas. Please try again — if this keeps happening, contact support.",
  },
];

/**
 * @param err - whatever was caught (viem error, generic Error, or anything else)
 * @param fallback - shown when nothing above matches; keep this generic and safe, never a raw error dump
 */
export function humanizeChainError(err: unknown, fallback = "This on-chain operation couldn't be completed. Please try again."): string {
  const outer = asViemLike(err);
  const inner = asViemLike(deepest(err));

  // viem's own shortMessage is already a clean one-liner for the vast
  // majority of cases — prefer it over both the pattern list and the raw
  // `.message`, unless a pattern below gives an even clearer, more specific
  // sentence for it.
  const candidates = [inner?.shortMessage, outer?.shortMessage, inner?.message, outer?.message, err instanceof Error ? err.message : undefined].filter(
    (m): m is string => typeof m === "string" && m.length > 0,
  );

  for (const candidate of candidates) {
    const match = PATTERNS.find((p) => p.test.test(candidate));
    if (match) return match.message;
  }

  const shortMessage = inner?.shortMessage ?? outer?.shortMessage;
  if (shortMessage) {
    // viem's shortMessage is written for developers but is already free of
    // stack traces/docs links/version strings — safe to surface directly.
    return shortMessage;
  }

  return fallback;
}
