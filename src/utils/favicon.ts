/**
 * Favicon helper for Capsule Hub.
 * Sets the browser favicon using high-resolution extension icons or inline SVG data URI.
 */
export const FAVICON_SVG_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%234f46e5'/%3E%3Cstop offset='100%25' stop-color='%237c3aed'/%3E%3C/linearGradient%3E%3ClinearGradient id='cap' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff'/%3E%3Cstop offset='100%25' stop-color='%23c7d2fe'/%3E%3C/linearGradient%3E%3ClinearGradient id='acc' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2338bdf8'/%3E%3Cstop offset='100%25' stop-color='%23818cf8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='32' y='32' width='448' height='448' rx='112' fill='url(%23bg)'/%3E%3Cg transform='translate(256, 256) rotate(-35)'%3E%3Crect x='-130' y='-55' width='260' height='110' rx='55' fill='url(%23cap)'/%3E%3Cpath d='M 0,-55 L 75,-55 A 55,55 0 0,1 75,55 L 0,55 Z' fill='url(%23acc)'/%3E%3Cline x1='0' y1='-55' x2='0' y2='55' stroke='%234338ca' stroke-width='8' stroke-linecap='round'/%3E%3Ccircle cx='-60' cy='0' r='14' fill='%236366f1'/%3E%3Ccircle cx='60' cy='0' r='14' fill='%23ffffff'/%3E%3C/g%3E%3Ccircle cx='395' cy='115' r='26' fill='%2310b981' stroke='%23ffffff' stroke-width='6'/%3E%3C/svg%3E";

export function setSidepanelFavicon() {
  if (typeof document === "undefined") return;

  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    document.head.appendChild(link);
  }

  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      link.href = chrome.runtime.getURL("icon32.plasmo.png");
    } else {
      link.type = "image/svg+xml";
      link.href = FAVICON_SVG_DATA_URI;
    }
  } catch {
    link.type = "image/svg+xml";
    link.href = FAVICON_SVG_DATA_URI;
  }
}
