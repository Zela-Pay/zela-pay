"use client";

/** Client-side call to /v1/dashboard/* through the authenticated proxy route. */
export async function dashApi<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/dashboard/${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      window.location.assign("/login");
      return { ok: false, error: "Session expired" };
    }
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? "Request failed" };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Network error. Try again." };
  }
}
