import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span className="small muted">© {new Date().getFullYear()} ZelaPay Checkout</span>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/docs">Docs</Link>
          <Link href="/docs/fees">Pricing</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Get started</Link>
          <a href="https://zelapay.xyz/app">ZelaPay App</a>
        </nav>
      </div>
    </footer>
  );
}
