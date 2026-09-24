import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="small muted">© {new Date().getFullYear()} Zela Payment Rails</span>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/docs">Docs</Link>
          <Link href="/docs/fees">Pricing</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Get started</Link>
        </nav>
      </div>
    </footer>
  );
}
