import { CheckoutCard } from "../../../components/CheckoutCard";

/**
 * The hosted checkout page — https://checkout.zelapay.xyz/pay/<sessionId>.
 * Same session model the embeddable widget renders inside an iframe/modal;
 * this route is also what the widget's "open in new tab" fallback links to.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <CheckoutCard sessionId={sessionId} />;
}
