import Link from "next/link";
import { cookies } from "next/headers";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { Coin3D } from "../components/Coin3D";
import { DemoWidget } from "../components/DemoWidget";
import { HeroSpotlight } from "../components/HeroSpotlight";

// The consumer side of the ecosystem lives on the main site.
const ZELAPAY_APP_URL = "https://zelapay.xyz/app";

function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9.5l4 4L15 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

const USE_CASES = [
  {
    href: "/docs/widget",
    label: "E-commerce stores",
    tagline: "Checkout widget",
    body: "Accept digital asset payments directly from your online store with a smooth checkout experience — one script tag, or a hosted page.",
  },
  {
    href: "/docs/quickstart",
    label: "Websites and applications",
    tagline: "API · SDK · widget",
    body: "Integrate payment functionality using the REST API, the server-side SDK, or the embeddable checkout widget.",
  },
  {
    href: "/docs/payment-links",
    label: "Payment links",
    tagline: "No integration required",
    body: "Create payment requests you can share with customers — a reusable URL or QR, fixed price or pay-what-you-want. No code at all.",
  },
  {
    href: "/docs/api",
    label: "Developers and platforms",
    tagline: "Build your own flow",
    body: "Build custom payment experiences using flexible integration tools, signed webhooks, and payment infrastructure.",
  },
];

const WALLETS = [
  { name: "ZelaPay App", note: "PIN-confirmed" },
  { name: "MetaMask" },
  { name: "Rabby" },
  { name: "Coinbase Wallet" },
  { name: "Other EVM wallets" },
];

const DEV_TOOLS = [
  { href: "/docs/api", title: "Payment API", body: "Create payment requests, verify transactions, and connect your backend to payment infrastructure." },
  { href: "/docs/sdk", title: "SDKs", body: "Integrate payment functionality without building every component from scratch." },
  { href: "/docs/widget", title: "Checkout widget", body: "Add a ready-made payment experience to your website with one script tag." },
  { href: "/docs/webhooks", title: "Webhooks", body: "Receive HMAC-signed payment status updates, retried until you acknowledge them." },
  { href: "/docs/quickstart", title: "Developer tools", body: "Test integrations, manage API credentials, and monitor transactions from the dashboard." },
];

const STEPS = [
  { title: "Create a session", body: "Call the API with an amount, or let the widget do it with your publishable key." },
  { title: "Customer pays", body: "They open the checkout, choose the ZelaPay App or another supported wallet, and confirm in USDC." },
  { title: "You get notified", body: "A signed webhook lands once the payment settles, and funds go to your wallet." },
];

// Copy rule: no "instant", "guaranteed" or "universal" claims here.
const SETTLEMENT = [
  "Digital asset payments settle directly on supported blockchain networks — today, in native USDC on Arc, with no swap step.",
  "Your business integrates payment functionality without building the underlying infrastructure.",
  "Every payment leaves a transparent, verifiable transaction record.",
];

const TRUST = [
  { title: "Transaction verification", body: "Payment status is verified onchain before a session is marked complete." },
  { title: "Payment visibility", body: "You and your customers can follow each payment from pending to confirmed." },
  { title: "Signed webhooks", body: "Every event is HMAC-signed so your backend can verify it came from ZelaPay." },
  { title: "Business controls", body: "Manage API keys, sessions, and account security from the dashboard." },
  { title: "Keys encrypted at rest", body: "Deposit keys are encrypted and only ever touched by the settlement job." },
  { title: "One flat fee", body: "1% of settled volume, deducted from what you receive. No monthly or setup fee." },
];

const ROADMAP = [
  { title: "Universal USDC settlement", body: "Accept USDC from supported networks and settle into a unified USDC balance on Arc." },
  { title: "More networks", body: "Solana · Ethereum · Base · Polygon · and more." },
  { title: "Cross-chain payments", body: "Let customers pay from supported networks without you managing multiple chains." },
  { title: "Global payouts", body: "Send USDC to customers, creators, vendors, and businesses across supported networks." },
  { title: "More wallets", body: "Connect ZelaPay with the wallets your customers already use." },
];

export default async function Home() {
  const signedIn = Boolean((await cookies()).get("zc_session"));

  return (
    <>
      <SiteHeader signedIn={signedIn} />

      <main>
        <div className="site-main">
          <HeroSpotlight>
          <section className="hero">
            <div>
              <span className="eyebrow"><span className="dot" aria-hidden="true" />ZelaPay Checkout · settles in USDC on Arc</span>
              <h1>Your checkout. Your customers. More ways to pay.</h1>
              <p className="hero-sub">
                Give your customers a simple way to pay with supported digital wallets. Integrate{" "}
                <strong>ZelaPay Checkout</strong> into your website, online store, or application — or share a
                payment link — and build a payment experience that works for your business.
              </p>
              <div className="hero-cta">
                <Link className="btn btn-primary" href="/signup">Start accepting payments</Link>
                <Link className="btn" href="/docs">Explore the documentation</Link>
              </div>
              <p className="hero-note">Free to start · 1% flat fee on settled volume · No monthly cost</p>
            </div>
            <div className="hero-visual">
              <Coin3D />
            </div>
          </section>
          </HeroSpotlight>
        </div>

        <section className="section" aria-labelledby="usecases-h">
          <div className="site-main">
            <div className="section-head">
              <h2 id="usecases-h">Built for the way businesses operate</h2>
              <p>One account, one dashboard, one set of webhooks — whichever way you integrate.</p>
            </div>
            <div className="tool-grid">
              {USE_CASES.map((t) => (
                <Link className="tool-card" href={t.href} key={t.label}>
                  <span className="tool-tagline">{t.tagline}</span>
                  <h3>{t.label}</h3>
                  <p>{t.body}</p>
                  <span className="tool-link">Learn more <ArrowRight /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="pay-h">
          <div className="site-main">
            <div className="section-head">
              <h2 id="pay-h">Your customers choose how they pay</h2>
              <p>
                Your business shouldn&rsquo;t have to limit its customers to one wallet. ZelaPay Checkout supports
                multiple payment experiences — customers can pay through the ZelaPay App or other supported crypto wallets.
              </p>
            </div>
            <ul className="wallet-chips">
              {WALLETS.map((w, i) => (
                <li key={w.name} className={i === 0 ? "primary" : undefined}>
                  {w.name}
                  {w.note && <span>{w.note}</span>}
                </li>
              ))}
            </ul>
            <p className="center-note small muted">
              Same sessions, same webhooks, whichever wallet pays. <Link href="/docs/payment-methods">Payment methods →</Link>
            </p>
          </div>
        </section>

        <section className="section" aria-labelledby="demo-h">
          <div className="site-main">
            <div className="demo-section-inner hero-stage">
              <div className="hero-grid" aria-hidden="true" />
              <div className="demo-section-copy">
                <span className="eyebrow"><span className="dot" aria-hidden="true" />Live demo</span>
                <h2 id="demo-h">This is the real product — not a mockup</h2>
                <p>Pick an amount, hit go, and the actual hosted checkout opens against a live session on Arc. Nothing here is staged.</p>
              </div>
              <div className="demo-widget-wrap">
                <DemoWidget />
              </div>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="dev-h">
          <div className="site-main">
            <div className="section-head left">
              <h2 id="dev-h">Everything you need to build payments</h2>
              <p>
                From a simple checkout button to a fully customized payment experience. Simple integrations, powerful possibilities.
              </p>
            </div>
            <div className="feature-grid">
              {DEV_TOOLS.map((f) => (
                <Link className="feature-card feature-link" href={f.href} key={f.title}>
                  <div className="icon" aria-hidden="true"><Check /></div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </Link>
              ))}
            </div>

            <div className="code-section-inner" style={{ marginTop: 40 }}>
              <div className="code-window">
                <div className="code-window-bar">
                  <span className="code-window-dot" /><span className="code-window-dot" /><span className="code-window-dot" />
                  <span className="code-window-name">checkout.ts</span>
                </div>
                <pre className="snippet">{`import { ZelaCheckoutClient } from "@zela-checkout/sdk";

const client = new ZelaCheckoutClient({ secretKey: process.env.ZELA_SECRET_KEY! });
const { checkoutUrl } = await client.sessions.create({ amount: "19.99" });
// redirect your customer to checkoutUrl`}</pre>
              </div>
              <ul className="code-checklist">
                {STEPS.map((s, i) => (
                  <li key={s.title}>
                    <span className="num">{i + 1}</span>
                    <div><strong>{s.title}</strong><span>{s.body}</span></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="settle-h">
          <div className="site-main">
            <div className="section-head">
              <h2 id="settle-h">From payment to settlement, built for the onchain economy</h2>
              <p>
                ZelaPay is building payment infrastructure designed to connect digital wallets, merchants, and
                applications through blockchain-powered settlement.
              </p>
            </div>
            <ol className="settle-flow" aria-label="Payment flow">
              {["Customer pays", "Verified onchain", "Settles in USDC", "You're notified"].map((s, i) => (
                <li key={s}><span className="num">{i + 1}</span>{s}</li>
              ))}
            </ol>
            <ul className="settle-points">
              {SETTLEMENT.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </section>

        <section className="section" aria-labelledby="trust-h">
          <div className="site-main">
            <div className="section-head left">
              <h2 id="trust-h">Built with control and transparency in mind</h2>
              <p>Clear transactions, transparent payment status, and appropriate safeguards. <Link href="/docs/security">Security details →</Link></p>
            </div>
            <div className="feature-grid">
              {TRUST.map((f) => (
                <div className="feature-card" key={f.title}>
                  <div className="icon" aria-hidden="true"><Check /></div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="roadmap-h">
          <div className="site-main">
            <div className="section-head">
              <span className="eyebrow roadmap-eyebrow"><span className="dot" aria-hidden="true" />Coming soon</span>
              <h2 id="roadmap-h">Building the future of USDC payments</h2>
              <p>
                We&rsquo;re starting with simple, reliable payments on Arc. The long-term vision: make USDC settlement
                feel native — regardless of where the payment starts. Pay anywhere. Settle on Arc.
              </p>
            </div>
            <div className="roadmap-grid">
              {ROADMAP.map((r) => (
                <div className="roadmap-card" key={r.title}>
                  <h3>{r.title}</h3>
                  <p>{r.body}</p>
                </div>
              ))}
            </div>
            <p className="disclaimer">
              Future network integrations and settlement capabilities are under development and subject to
              availability, technical support, and applicable requirements.
            </p>
          </div>
        </section>

        <section className="site-main">
          <div className="cta-band">
            <h2>Your business, ready for global payments</h2>
            <p>Create a merchant account and get your API keys in under a minute.</p>
            <div className="hero-cta">
              <Link className="btn btn-primary" href="/signup">Create a merchant account</Link>
              <Link className="btn" href="/docs">Browse the docs</Link>
            </div>
            <p className="cross-link small muted">
              Paying, not accepting? <a href={ZELAPAY_APP_URL}>Explore the ZelaPay App</a> — the wallet side of the same ecosystem.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
