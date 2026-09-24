import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { DocsNav } from "../../components/DocsNav";
import { DocsPager } from "../../components/DocsPager";

export const dynamic = "force-dynamic";

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const signedIn = Boolean((await cookies()).get("zc_session"));

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <div className="shell" style={{ minHeight: "calc(100vh - 65px)" }}>
        <aside className="sidebar">
          <Link href="/" className="small muted" style={{ padding: "0 10px 16px", display: "block" }}>← Back to site</Link>
          <DocsNav />
        </aside>
        <main className="content">
          <div className="docs-content">
            {children}
            <DocsPager />
          </div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
