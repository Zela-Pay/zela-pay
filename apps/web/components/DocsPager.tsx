"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsPager } from "../lib/docsNav";

export function DocsPager() {
  const pathname = usePathname();
  const { prev, next } = docsPager(pathname);
  if (!prev && !next) return null;

  return (
    <div className="docs-pager">
      {prev ? (
        <Link href={prev.href}>
          <span className="dir">← Previous</span>
          {prev.label}
        </Link>
      ) : <span />}
      {next && (
        <Link href={next.href} className="next">
          <span className="dir">Next →</span>
          {next.label}
        </Link>
      )}
    </div>
  );
}
