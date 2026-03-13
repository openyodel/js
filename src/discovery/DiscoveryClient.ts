/**
 * DiscoveryClient — finds Yodel endpoints via the well-known endpoint.
 *
 * Derived from:
 * - SDK Design Guide §3.5 (Discovery)
 * - SDK Design Guide §5.2 (discover)
 * - Spec §13 (Service Discovery)
 * - Spec §13.2 (Well-Known Endpoint)
 *
 * Spec §13: "Yodel works without discovery." Discovery is an optional
 * convenience layer that automates finding Yodel endpoints.
 */

import type { YodelDiscovery } from "../types/index.js";
import { YodelError } from "../types/errors.js";

/**
 * Discovery client for querying the well-known endpoint.
 *
 * ```ts
 * const discovery = new DiscoveryClient();
 * const info = await discovery.discover("http://localhost:11434");
 * console.log(info.capabilities); // ["streaming"]
 * ```
 */
export class DiscoveryClient {
  /**
   * Query the well-known endpoint of a Yodel-aware host.
   * SDK Design Guide §5.2: `discover()` — queries `/.well-known/yodel.json`.
   * Spec §13.2
   *
   * @param baseUrl - The base URL of the host to discover.
   * @returns The parsed discovery response.
   * @throws {YodelError} On network failure, HTTP error, or invalid response.
   */
  async discover(baseUrl: string): Promise<YodelDiscovery> {
    const url = `${baseUrl.replace(/\/$/, "")}/.well-known/yodel.json`;

    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new YodelError(
        `Network error discovering ${url}: ${err instanceof Error ? err.message : String(err)}`,
        "network_error",
        0,
      );
    }

    if (res.status === 404) {
      throw new YodelError(
        `Well-known endpoint not found: ${url}`,
        "not_found_error",
        404,
      );
    }

    if (!res.ok) {
      throw new YodelError(
        `Discovery failed with HTTP ${res.status}: ${url}`,
        "backend_error",
        res.status,
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new YodelError(
        `Invalid JSON from discovery endpoint: ${url}`,
        "validation_error",
        res.status,
      );
    }

    return parseDiscoveryResponse(body, url);
  }
}

// ---------------------------------------------------------------------------
// Validation (private)
// ---------------------------------------------------------------------------

/** Validate and map a raw discovery JSON body to YodelDiscovery. */
function parseDiscoveryResponse(
  body: unknown,
  url: string,
): YodelDiscovery {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new YodelError(
      `Invalid discovery response from ${url}: expected JSON object`,
      "validation_error",
      0,
    );
  }

  const raw = body as Record<string, unknown>;

  if (typeof raw.yodel_version !== "number" || !Number.isInteger(raw.yodel_version)) {
    throw new YodelError(
      `Invalid discovery response from ${url}: missing or invalid yodel_version`,
      "validation_error",
      0,
    );
  }

  if (raw.endpoints === null || typeof raw.endpoints !== "object" || Array.isArray(raw.endpoints)) {
    throw new YodelError(
      `Invalid discovery response from ${url}: missing or invalid endpoints`,
      "validation_error",
      0,
    );
  }

  return {
    yodelVersion: raw.yodel_version,
    endpoints: raw.endpoints as Record<string, string>,
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities as string[] : [],
    gateway: typeof raw.gateway === "string" ? raw.gateway : null,
    agents: Array.isArray(raw.agents)
      ? (raw.agents as Record<string, unknown>[]).map((a) => ({
          slug: String(a.slug ?? ""),
          ...(a.name != null ? { name: String(a.name) } : {}),
          ...(a.model != null ? { model: String(a.model) } : {}),
        }))
      : [],
  };
}
