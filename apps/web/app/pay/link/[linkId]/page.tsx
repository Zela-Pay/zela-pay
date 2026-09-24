import { PaymentLinkCard } from "../../../../components/PaymentLinkCard";

/**
 * The public Payment Link page — https://checkout.zelapay.xyz/pay/link/<id>.
 * A reusable entry point: every visit that pays creates a fresh checkout
 * session for this link, then hands off to the same /pay/[sessionId] flow
 * used everywhere else.
 */
export default async function PaymentLinkPage({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = await params;
  return <PaymentLinkCard linkId={linkId} />;
}
