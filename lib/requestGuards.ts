/**
 * Request checks run by middleware.ts before Clerk sees the request. Kept free
 * of Next and Clerk imports so they can be unit-tested.
 */

// Vulnerability scanners and brute-force tools that announce themselves. Generic HTTP
// clients (curl, python-requests, Go) are not listed: integrations and monitors use them.
const SCANNER = /sqlmap|nikto|nmap|masscan|zgrab|nuclei|wpscan|dirbuster|gobuster|feroxbuster|ffuf|acunetix|nessus|openvas|w3af|havij|netsparker|appscan|whatweb|zmeu|jaeles/i;

/** True for a missing or blank User-Agent, or one that names a known scanner. */
export function isSuspiciousUserAgent(userAgent: string | null): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return SCANNER.test(userAgent);
}

/** Payment-provider webhooks are authenticated by signature and must never be turned away by a header heuristic. */
export function isUserAgentExempt(pathname: string): boolean {
  return pathname.startsWith('/api/webhooks/');
}

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|\d+\.\d+\.\d+\.\d+)$/;

/**
 * True when a production server received a request that the proxy in front
 * of it says arrived over plain http. Local and bare-IP hosts are left alone
 * so `next start` keeps working on a laptop or a phone on the same network.
 */
export function needsHttpsRedirect(nodeEnv: string | undefined, forwardedProto: string | null, hostname: string): boolean {
  if (nodeEnv !== 'production') return false;
  if (forwardedProto?.split(',')[0].trim().toLowerCase() !== 'http') return false;
  return !LOCAL_HOST.test(hostname);
}
