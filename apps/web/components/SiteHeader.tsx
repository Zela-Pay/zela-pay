"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/fees", label: "Pricing" },
];

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 12 12" fill="none">
      <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="site-header">
      <div className="nav-pill">
        <Link href="/" className="wordmark" onClick={() => setOpen(false)}>
          <Logo tagline={false} />
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <div className="links row" style={{ gap: 28 }}>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </div>
          <div className="actions">
            {signedIn ? (
              <Link className="nav-cta-group" href="/dashboard">
                <span className="nav-cta">Dashboard</span>
                <span className="nav-cta-arrow" aria-hidden="true"><ArrowIcon /></span>
              </Link>
            ) : (
              <>
                <Link className="btn" href="/login">Sign in</Link>
                <Link className="nav-cta-group" href="/signup">
                  <span className="nav-cta">Get started</span>
                  <span className="nav-cta-arrow" aria-hidden="true"><ArrowIcon /></span>
                </Link>
              </>
            )}
          </div>
        </nav>

        <button
          className="nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          )}
        </button>
      </div>

      <div id="mobile-nav" className={`mobile-nav-panel${open ? " open" : ""}`}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
        ))}
        <div className="actions">
          {signedIn ? (
            <Link className="btn btn-primary" href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
          ) : (
            <>
              <Link className="btn btn-primary" href="/signup" onClick={() => setOpen(false)}>Get started</Link>
              <Link className="btn" href="/login" onClick={() => setOpen(false)}>Sign in</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
