import { redirect } from "next/navigation";
import { getMe } from "../../../lib/api";
import { SettingsForms } from "../../../components/SettingsForms";

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p className="muted">Business details, webhook endpoint, payout wallet and password.</p>
      </div>
      <SettingsForms
        name={me.name}
        settlementWallet={me.settlementWallet}
        settlementToken={me.settlementToken}
        webhookUrl={me.webhookUrl}
        hasWebhookSecret={me.hasWebhookSecret}
      />
    </>
  );
}
