import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export interface UrlPolicy {
  storageHostname: string;
  callbackOrigin: string;
  callbackPath: string;
}

const forbiddenAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) forbiddenAddresses.addSubnet(network, prefix, "ipv4");
forbiddenAddresses.addSubnet("::", 128, "ipv6");
forbiddenAddresses.addSubnet("::1", 128, "ipv6");
forbiddenAddresses.addSubnet("fc00::", 7, "ipv6");
forbiddenAddresses.addSubnet("fe80::", 10, "ipv6");
forbiddenAddresses.addSubnet("ff00::", 8, "ipv6");
forbiddenAddresses.addSubnet("2001:db8::", 32, "ipv6");

export function assertStorageObjectUrl(
  rawUrl: string,
  expectedObjectPath: string,
  operation: "download" | "upload",
  policy: UrlPolicy,
): URL {
  const url = parseSafeHttpsUrl(rawUrl);
  assertExactHostname(url, policy.storageHostname);

  const decodedPath = decodePathOnce(url.pathname);
  const prefixes = operation === "download"
    ? ["/storage/v1/object/sign/mark-media/", "/storage/v1/object/authenticated/mark-media/"]
    : ["/storage/v1/object/upload/sign/mark-media/"];
  const prefix = prefixes.find((candidate) => decodedPath.startsWith(candidate));
  if (!prefix || decodedPath.slice(prefix.length) !== expectedObjectPath) {
    throw new Error("storage URL is not bound to the expected object path");
  }
  if (url.search === "") throw new Error("unsigned Storage URL is forbidden");
  return url;
}

export function assertCallbackUrl(rawUrl: string, policy: UrlPolicy): URL {
  const url = parseSafeHttpsUrl(rawUrl);
  const configured = new URL(policy.callbackOrigin);
  assertExactHostname(url, configured.hostname);
  if (url.origin !== configured.origin || url.pathname !== policy.callbackPath || url.search !== "") {
    throw new Error("callback URL is not the configured exact endpoint");
  }
  return url;
}

export function assertFinalResponseOrigin(responseUrl: string, expectedUrl: URL): void {
  const actual = parseSafeHttpsUrl(responseUrl);
  if (actual.origin !== expectedUrl.origin || actual.pathname !== expectedUrl.pathname) {
    throw new Error("network response origin or path changed");
  }
}

export async function assertHostnameResolvesPublic(
  hostname: string,
  resolver: typeof lookup = lookup,
  signal?: AbortSignal,
): Promise<void> {
  const lookupPromise = resolver(hostname, { all: true, verbatim: true });
  const addresses = signal ? await rejectOnAbort(lookupPromise, signal) : await lookupPromise;
  if (addresses.length === 0) throw new Error("hostname did not resolve");
  for (const result of addresses) {
    const family = result.family === 4 ? "ipv4" : "ipv6";
    if (forbiddenAddresses.check(result.address, family)) {
      throw new Error("hostname resolves to a private or reserved address");
    }
  }
}

async function rejectOnAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason;
  return await new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function parseSafeHttpsUrl(rawUrl: string): URL {
  if (rawUrl.length < 1 || rawUrl.length > 8_192) throw new Error("URL length is invalid");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL is invalid");
  }
  if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443") ||
      url.username !== "" || url.password !== "" || url.hash !== "") {
    throw new Error("URL must use HTTPS port 443 without credentials or fragments");
  }
  if (isIP(stripIpv6Brackets(url.hostname)) !== 0) throw new Error("IP literal destinations are forbidden");
  if (url.hostname.endsWith(".") || url.hostname.includes("%")) throw new Error("hostname is ambiguous");
  return url;
}

function assertExactHostname(url: URL, configuredHostname: string): void {
  const expected = configuredHostname.toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(expected) || isIP(expected) !== 0) {
    throw new Error("configured hostname is invalid");
  }
  if (url.hostname.toLowerCase() !== expected) throw new Error("URL hostname is not allowlisted");
}

function decodePathOnce(pathname: string): string {
  if (pathname.includes("\\") || pathname.includes("//")) throw new Error("URL path is ambiguous");
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new Error("URL path encoding is invalid");
  }
  if (decoded.includes("\\") || decoded.includes("//") || decoded.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("URL path traversal or ambiguity is forbidden");
  }
  try {
    if (decodeURIComponent(decoded) !== decoded) throw new Error("URL path is double encoded");
  } catch (error) {
    if (error instanceof URIError) throw new Error("URL path encoding is invalid");
    throw error;
  }
  return decoded;
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}
