import { safeFetch } from "../net";
import type { Finding } from "../types";

const SENSITIVE_PATHS = [
  { path: "/.env", id: "env-file" },
  { path: "/.git/config", id: "git-config" },
  { path: "/.git/HEAD", id: "git-head" },
  { path: "/wp-config.php.bak", id: "wp-config-bak" },
  { path: "/.DS_Store", id: "ds-store" },
  { path: "/config.php.bak", id: "config-php-bak" },
  { path: "/backup.zip", id: "backup-zip" },
];

export async function checkExposedFiles(baseUrl: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  await Promise.all(
    SENSITIVE_PATHS.map(async ({ path, id }) => {
      try {
        // Manual redirect handling: a site that redirects every unknown path to
        // its homepage (a "soft 404") would otherwise look like every sensitive
        // file exists.
        const res = await safeFetch(baseUrl + path, {
          method: "GET",
          redirect: "manual",
          timeoutMs: 6000,
        });

        if (res.status === 200) {
          const contentType = res.headers.get("content-type") ?? "";
          if (!contentType.includes("text/html")) {
            findings.push({
              id: `exposed-${id}`,
              category: "security",
              title: `Potentially exposed sensitive file: ${path}`,
              severity: "critical",
              detail: `This path publicly returned HTTP 200 (content-type: ${contentType || "unknown"}). Verify manually — this can be a false positive.`,
            });
          }
        }
      } catch {
        // Unreachable/blocked — not a finding either way.
      }
    })
  );

  return findings;
}
