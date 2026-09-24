/**
 * Minimal, dependency-free modal shell that hosts the checkout page in an
 * iframe. Kept framework-agnostic and small on purpose — this loads on a
 * merchant's own site, so no React/CSS-file dependency, and body scroll is
 * deliberately left untouched (locking it risks fighting the host page's
 * own layout/scroll state, unlike a first-party page we fully control).
 */

const FADE_MS = 160;

export function openCheckoutModal(
  checkoutUrl: string | null,
  opts: { onClose?: () => void; loading?: boolean; onErrorClose?: () => void },
): { close: () => void; showError: (message: string) => void; showIframe: (url: string) => void } {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const overlay = document.createElement("div");
  overlay.setAttribute("data-zela-checkout-overlay", "");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Zela Payment Rails Checkout");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "2147483647",
    opacity: reduceMotion ? "1" : "0",
    transition: reduceMotion ? "none" : `opacity ${FADE_MS}ms ease`,
  } satisfies Partial<CSSStyleDeclaration>);

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "relative",
    width: "min(420px, 92vw)",
    height: "min(640px, 90vh)",
    borderRadius: "16px",
    background: "#fff",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
    transform: reduceMotion ? "none" : "scale(0.96)",
    transition: reduceMotion ? "none" : `transform ${FADE_MS}ms ease`,
    overflow: "hidden",
  } satisfies Partial<CSSStyleDeclaration>);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close checkout");
  closeBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "10px",
    right: "10px",
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    border: "0",
    background: "rgba(0,0,0,0.06)",
    color: "#3f3f46",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: "1",
  } satisfies Partial<CSSStyleDeclaration>);
  closeBtn.addEventListener("click", () => close());

  const body = document.createElement("div");
  Object.assign(body.style, { width: "100%", height: "100%" } satisfies Partial<CSSStyleDeclaration>);
  panel.appendChild(body);
  panel.appendChild(closeBtn);
  overlay.appendChild(panel);

  let iframe: HTMLIFrameElement | null = null;
  let settled = false;

  function renderLoading() {
    body.innerHTML = "";
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
    } satisfies Partial<CSSStyleDeclaration>);
    const spinner = document.createElement("div");
    Object.assign(spinner.style, {
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      border: "3px solid rgba(0,0,0,0.12)",
      borderTopColor: "#18181b",
      animation: reduceMotion ? "none" : "zela-checkout-spin 0.8s linear infinite",
    } satisfies Partial<CSSStyleDeclaration>);
    wrap.appendChild(spinner);
    body.appendChild(wrap);

    if (!reduceMotion && !document.getElementById("zela-checkout-spin-kf")) {
      const style = document.createElement("style");
      style.id = "zela-checkout-spin-kf";
      style.textContent = "@keyframes zela-checkout-spin { to { transform: rotate(360deg); } }";
      document.head.appendChild(style);
    }
  }

  function renderIframe(url: string) {
    body.innerHTML = "";
    iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "Zela Payment Rails Checkout";
    Object.assign(iframe.style, { width: "100%", height: "100%", border: "0" } satisfies Partial<CSSStyleDeclaration>);
    body.appendChild(iframe);
  }

  function renderError(message: string) {
    body.innerHTML = "";
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      padding: "24px",
      textAlign: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#18181b",
    } satisfies Partial<CSSStyleDeclaration>);
    const text = document.createElement("p");
    text.textContent = message;
    Object.assign(text.style, { margin: "0", fontSize: "14px" } satisfies Partial<CSSStyleDeclaration>);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Close";
    Object.assign(btn.style, {
      border: "1px solid #e4e4e7",
      borderRadius: "8px",
      padding: "8px 16px",
      background: "#fff",
      cursor: "pointer",
      fontSize: "13.5px",
    } satisfies Partial<CSSStyleDeclaration>);
    btn.addEventListener("click", () => close());
    wrap.appendChild(text);
    wrap.appendChild(btn);
    body.appendChild(wrap);
  }

  if (opts.loading) renderLoading();
  else if (checkoutUrl) renderIframe(checkoutUrl);

  function close() {
    if (settled) return;
    settled = true;
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("message", onMessage);
    const finish = () => {
      overlay.remove();
      previouslyFocused?.focus?.();
    };
    if (reduceMotion) {
      finish();
    } else {
      overlay.style.opacity = "0";
      panel.style.transform = "scale(0.96)";
      setTimeout(finish, FADE_MS);
    }
    opts.onClose?.();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  const onMessage = (e: MessageEvent) => {
    if (iframe && e.source === iframe.contentWindow && e.data?.type === "zela-checkout:settled") close();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener("keydown", onKey);
  window.addEventListener("message", onMessage);

  document.body.appendChild(overlay);
  closeBtn.focus();
  // Trigger the entrance transition on the next frame (can't transition from the same paint it was inserted in).
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    panel.style.transform = "scale(1)";
  });

  return { close, showError: renderError, showIframe: renderIframe };
}
