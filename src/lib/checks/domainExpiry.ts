import type { Finding } from "../types";

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

/**
 * Uses rdap.org as a bootstrap so we don't need to know which RDAP server
 * owns a given TLD. Best-effort only — some ccTLDs (incl. some .co.za
 * registries) don't expose RDAP, so a failure here just means no finding,
 * not an error surfaced to the user.
 */
export async function checkDomainExpiry(domain: string): Promise<Finding[]> {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = await res.json();
    const events: RdapEvent[] = data.events ?? [];
    const expirationEvent = events.find((e) => e.eventAction === "expiration");
    if (!expirationEvent) return [];

    const expiry = new Date(expirationEvent.eventDate);
    const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86_400_000);

    if (daysLeft < 0) {
      return [{ id: "domain-expired", category: "domain", title: "Domain registration has expired", severity: "critical", detail: `Expired on ${expiry.toDateString()}` }];
    }
    if (daysLeft < 30) {
      return [{ id: "domain-expiring", category: "domain", title: "Domain registration is expiring soon", severity: "warning", detail: `Expires in ${daysLeft} day(s), on ${expiry.toDateString()}` }];
    }
    return [{ id: "domain-ok", category: "domain", title: "Domain registration is current", severity: "good", detail: `Expires ${expiry.toDateString()}` }];
  } catch {
    return [];
  }
}
