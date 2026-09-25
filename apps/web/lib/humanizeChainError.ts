/**
 * Turns a raw wagmi/viem error (thrown by useSwitchChain/useWriteContract,
 * etc.) into a short sentence a paying customer can actually understand —
 * mirrors apps/api/src/services/blockchainError.ts's approach and pattern
 * list, since wagmi's errors are viem errors underneath (same
 * shortMessage/name/cause shape), just thrown in the browser instead of
 * on the server.
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

function deepest(err: unknown, depth = 0): unknown {
  if (depth > 5) return err;
  const v = asViemLike(err);
  if (v?.cause) return deepest(v.cause, depth + 1);
  return err;
}

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /user rejected/i,
    message: "Payment cancelled in your wallet.",
  },
  {
    test: /insufficient funds/i,
    message: "Your wallet doesn't have enough USDC to cover this payment and its network fee.",
  },
  {
    test: /chain not configured|does not support the requested chain|unrecognized chain/i,
    message: "Your wallet doesn't have the Arc network added. Add it in your wallet, then try again.",
  },
  {
    test: /(HTTP request failed|fetch failed|network.*(unavailable|error))/i,
    message: "Couldn't reach the network right now. Please try again in a moment.",
  },
  {
    test: /timeout/i,
    message: "The network took too long to respond. Check your wallet before retrying — the payment may still go through.",
  },
  {
    test: /execution reverted/i,
    message: "The payment was rejected on-chain. Please check your balance and try again.",
  },
];

export function humanizeChainError(err: unknown, fallback = "Payment failed. Please try again."): string {
  const outer = asViemLike(err);
  const inner = asViemLike(deepest(err));

  const candidates = [inner?.shortMessage, outer?.shortMessage, inner?.message, outer?.message, err instanceof Error ? err.message : undefined].filter(
    (m): m is string => typeof m === "string" && m.length > 0,
  );

  for (const candidate of candidates) {
    const match = PATTERNS.find((p) => p.test.test(candidate));
    if (match) return match.message;
  }

  const shortMessage = inner?.shortMessage ?? outer?.shortMessage;
  if (shortMessage) return shortMessage;

  return fallback;
}
