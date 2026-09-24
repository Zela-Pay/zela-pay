"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "../lib/docsNav";

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation">
      {DOCS_NAV.map((group) => (
        <div className="docs-nav-group" key={group.label}>
          <div className="group-label">{group.label}</div>
          <div className="nav">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
