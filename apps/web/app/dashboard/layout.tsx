import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMe } from "../../lib/api";
import { DashboardNav, SignOutButton } from "../../components/DashboardNav";
import { Logo } from "../../components/Logo";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) redirect("/login");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
        </div>
        <DashboardNav />
        <div className="foot">
          <p className="small muted" style={{ marginBottom: 8, overflowWrap: "anywhere" }}>
            {me.name}
            <br />
            {me.email}
          </p>
          <SignOutButton />
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
