import tls from "node:tls";
import { resolvePinnedPublicAddress } from "../net";
import type { Finding } from "../types";

export async function checkSsl(hostname: string): Promise<Finding[]> {
  // Resolve-then-connect atomically to the same validated IP, so there's no
  // window between "checked it's public" and "connected to it" for a
  // malicious DNS server to swap in a private address (see net.ts).
  let pinnedIp: string;
  try {
    pinnedIp = await resolvePinnedPublicAddress(hostname);
  } catch (err) {
    return [
      {
        id: "ssl-unreachable",
        category: "security",
        title: "Site is not reachable over HTTPS",
        severity: "critical",
        detail: err instanceof Error ? err.message : String(err),
      },
    ];
  }

  return new Promise((resolve) => {
    const findings: Finding[] = [];
    let settled = false;

    const finish = (extra?: Finding) => {
      if (settled) return;
      settled = true;
      if (extra) findings.push(extra);
      resolve(findings);
    };

    // rejectUnauthorized is intentionally off: this connection carries no
    // application data and nothing here trusts it. We're deliberately
    // connecting to sites with invalid/expired/self-signed certs so we can
    // *report* that as a finding via socket.authorized below — with the
    // default true, Node would throw before we ever got that detail.
    const socket = tls.connect(
      {
        host: pinnedIp,
        port: 443,
        servername: hostname,
        timeout: 8000,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const protocol = socket.getProtocol();

        if (!socket.authorized) {
          findings.push({
            id: "ssl-invalid",
            category: "security",
            title: "SSL certificate is not valid or trusted",
            severity: "critical",
            detail: socket.authorizationError ? String(socket.authorizationError) : "Certificate could not be verified by a trusted authority.",
          });
        } else {
          findings.push({
            id: "ssl-valid",
            category: "security",
            title: "SSL certificate is valid and trusted",
            severity: "good",
            detail: cert?.issuer ? `Issued by ${cert.issuer.O ?? cert.issuer.CN ?? "a trusted authority"}` : "",
          });
        }

        if (cert?.valid_to) {
          const expiry = new Date(cert.valid_to);
          const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86_400_000);
          if (daysLeft < 0) {
            findings.push({
              id: "ssl-expired",
              category: "security",
              title: "SSL certificate has expired",
              severity: "critical",
              detail: `Expired on ${expiry.toDateString()}`,
            });
          } else if (daysLeft < 14) {
            findings.push({
              id: "ssl-expiring",
              category: "security",
              title: "SSL certificate is expiring soon",
              severity: "warning",
              detail: `Expires in ${daysLeft} day(s), on ${expiry.toDateString()}`,
            });
          }
        }

        if (protocol === "TLSv1" || protocol === "TLSv1.1") {
          findings.push({
            id: "tls-outdated",
            category: "security",
            title: "Server supports an outdated TLS version",
            severity: "warning",
            detail: `Negotiated protocol: ${protocol}. Modern browsers are dropping support for this.`,
          });
        }

        socket.end();
        finish();
      }
    );

    socket.on("error", (err) => {
      finish({
        id: "ssl-unreachable",
        category: "security",
        title: "Site is not reachable over HTTPS",
        severity: "critical",
        detail: err.message,
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      finish({
        id: "ssl-timeout",
        category: "security",
        title: "HTTPS connection timed out",
        severity: "critical",
        detail: "No response within 8 seconds.",
      });
    });
  });
}
