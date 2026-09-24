export interface DocLink {
  href: string;
  label: string;
}

export interface DocGroup {
  label: string;
  items: DocLink[];
}

export const DOCS_NAV: DocGroup[] = [
  {
    label: "Getting started",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/quickstart", label: "Quickstart" },
      { href: "/docs/payment-methods", label: "Payment methods" },
    ],
  },
  {
    label: "Integrate",
    items: [
      { href: "/docs/widget", label: "Widget" },
      { href: "/docs/sdk", label: "Server SDK" },
      { href: "/docs/api", label: "REST API" },
      { href: "/docs/webhooks", label: "Webhooks" },
    ],
  },
  {
    label: "Payment Links",
    items: [{ href: "/docs/payment-links", label: "Payment links" }],
  },
  {
    label: "Reference",
    items: [
      { href: "/docs/fees", label: "Fees" },
      { href: "/docs/security", label: "Security" },
    ],
  },
];

export const DOCS_FLAT: DocLink[] = DOCS_NAV.flatMap((g) => g.items);

export function docsPager(pathname: string): { prev: DocLink | null; next: DocLink | null } {
  const i = DOCS_FLAT.findIndex((d) => d.href === pathname);
  return { prev: i > 0 ? DOCS_FLAT[i - 1]! : null, next: i >= 0 && i < DOCS_FLAT.length - 1 ? DOCS_FLAT[i + 1]! : null };
}
