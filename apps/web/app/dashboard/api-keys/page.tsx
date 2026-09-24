import { apiFetch } from "../../../lib/api";
import { ApiKeysManager } from "../../../components/ApiKeysManager";

export default async function ApiKeysPage() {
  const res = await apiFetch("/v1/dashboard/api-keys");
  const { keys } = await res.json();

  return (
    <>
      <div className="page-head">
        <h1>API keys</h1>
        <p className="muted">
          Use the <b>secret key</b> from your server to create sessions. Use the <b>publishable key</b> in the browser
          widget. Never put a secret key in client-side code.
        </p>
      </div>
      <ApiKeysManager initialKeys={keys} />
    </>
  );
}
