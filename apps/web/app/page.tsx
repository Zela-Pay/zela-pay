import Link from "next/link";
import { cookies } from "next/headers";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { Coin3D } from "../components/Coin3D";
import { DemoWidget } from "../components/DemoWidget";
import { HeroSpotlight } from "../components/HeroSpotlight";

function ArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOOLS = [
  {
    href: "/docs",
    label: "Checkout",
    tagline: "Embeddable & hosted",
    body: "Drop a script tag on your site, or send customers to a hosted page. Amount in, session created, customer pays with the Zela app or any EVM wallet — same webhooks either way.",
  },
  {
    href: "/docs/payment-links",
    label: "Payment Links",
    tagline: "No integration required",
    body: "A reusable URL or QR from your dashboard — fixed price or pay-what-you-want. Never expires, works for donations, invoices, or a link in a DM. No code at all.",
  },
];

const FEATURES = [
  {
    title: "Direct settlement",
    body: "USDC is the settlement currency directly on Arc — no swap, no approval step.",
  },
  {
    title: "Pay any way",
    body: "Customers open the Zela app for a PIN-confirmed payment, or connect any EVM wallet — MetaMask, Rabby, Coinbase Wallet.",
  },
  {
    title: "Drop-in or hosted",
    body: "Embed the widget with one script tag, or send customers to a hosted checkout page. Same sessions, same webhooks.",
  },
  {
    title: "Payment links, no code",
    body: "Create a reusable link or QR from the dashboard — fixed or pay-what-you-want — and share it. No integration needed.",
  },
  {
    title: "Signed webhooks",
    body: "Get a checkout.session.completed event the moment funds settle, HMAC-signed and retried until you acknowledge it.",
  },
  {
    title: "One flat fee",
    body: "1% of settled volume, deducted from what you receive. No monthly fee, no setup fee, no surprise chargebacks.",
  },
  {
    title: "Your keys, your funds",
    body: "Deposit keys are encrypted at rest and only ever touched by the settlement job. Funds go straight to your wallet.",
  },
];

const STEPS = [
  { title: "Create a session", body: "Call the API with an amount, or let the widget do it with your publishable key." },
  { title: "Customer pays", body: "They open the hosted page, pick Zela app or a wallet, and confirm — in native USDC." },
  { title: "You get notified", body: "A signed webhook lands the moment it settles. Funds are already in your wallet." },
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
              <span className="eyebrow"><span className="dot" aria-hidden="true" />Zela Payment Rails · built on Arc</span>
              <h1>Accept USDC, settled the moment it arrives.</h1>
              <p className="hero-sub">
                <strong>Checkout</strong> is the first rail: embed it on any website or share it as a link.
                Customers pay with the Zela app or any EVM wallet, in Arc&rsquo;s native USDC — no swap, no waiting.
              </p>
              <div className="hero-cta">
                <Link className="btn btn-primary" href="/signup">Create a merchant account</Link>
                <Link className="btn" href="/docs">Read the docs</Link>
              </div>
              <p className="hero-note">Free to start · 1% flat fee on settled volume · No monthly cost</p>
            </div>
            <div className="hero-visual">
              <Coin3D />
            </div>
          </section>
          </HeroSpotlight>
        </div>

        <section className="section" aria-labelledby="tools-h">
          <div className="site-main">
            <div className="section-head">
              <h2 id="tools-h">Two rails, one account</h2>
              <p>Pick the integration that fits — same settlement, same dashboard, same webhooks underneath.</p>
            </div>
            <div className="tool-grid">
              {TOOLS.map((t) => (
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

        <section className="section" aria-labelledby="demo-h">
          <div className="site-main">
            <div className="section-head">
              <h2 id="demo-h">Try it — this is the real product</h2>
              <p>Pick an amount, hit go, and the actual hosted checkout opens — live, not a mockup.</p>
            </div>
            <DemoWidget />
          </div>
        </section>

        <section className="section" aria-labelledby="features-h">
          <div className="site-main">
            <div className="section-head">
              <h2 id="features-h">Everything a checkout needs</h2>
              <p>No token accounts, no swap routing, no reconciliation spreadsheets.</p>
            </div>
            <div className="feature-grid">
              {FEATURES.map((f) => (
                <div className="feature-card" key={f.title}>
                  <div className="icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9.5l4 4L15 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="how-h">
          <div className="site-main">
            <div className="section-head">
              <h2 id="how-h">How it works</h2>
              <p>Three calls, one webhook.</p>
            </div>
            <div className="steps">
              {STEPS.map((s, i) => (
                <div className="step" key={i}>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="code-h">
          <div className="site-main">
            <div className="section-head">
              <h2 id="code-h">Three lines to start</h2>
              <p>Server-side SDK, or a plain REST call — your choice.</p>
            </div>
            <div className="code-panel">
              <pre className="snippet">{`import { ZelaCheckoutClient } from "@zela-checkout/sdk";

const client = new ZelaCheckoutClient({ secretKey: process.env.ZELA_SECRET_KEY! });
const { checkoutUrl } = await client.sessions.create({ amount: "19.99" });
// redirect your customer to checkoutUrl`}</pre>
            </div>
          </div>
        </section>

        <section className="site-main">
          <div className="cta-band">
            <h2>Start accepting USDC today</h2>
            <p>Create a merchant account and get your API keys in under a minute.</p>
            <div className="hero-cta">
              <Link className="btn btn-primary" href="/signup">Create a merchant account</Link>
              <Link className="btn" href="/docs">Browse the docs</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
