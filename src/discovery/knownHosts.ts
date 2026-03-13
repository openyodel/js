/**
 * Known Hosts — local configuration for pre-configured Yodel endpoints.
 *
 * Derived from:
 * - Spec §13.4 (Configuration File / Known Hosts)
 *
 * Spec §13.4: Clients MAY maintain a local configuration file listing
 * known Yodel endpoints. Format and storage location are platform-specific.
 *
 * Known hosts intentionally do NOT contain `yodel_version` — the protocol
 * version is negotiated at runtime. The client stores only the URL.
 *
 * Configured hosts ALWAYS take precedence over discovery results.
 */

import { YodelError } from "../types/errors.js";

/**
 * A known host entry.
 * Spec §13.4: Recommended format.
 */
export interface KnownHost {
  readonly name: string;
  readonly url: string;
}

/**
 * Parse and validate an array of known host entries.
 *
 * This is a pure function — it has no side effects and no dependency
 * on network or storage. Storage (localStorage, IndexedDB, file system)
 * is the caller's responsibility.
 *
 * Fails fast on the first invalid entry (SDK Design Guide §10 Rule 5).
 *
 * @param hosts - Raw known host entries to validate.
 * @returns Validated known hosts with normalized URLs.
 * @throws {YodelError} On invalid entry (empty name, invalid URL).
 */
export function parseKnownHosts(
  hosts: readonly KnownHost[],
): readonly KnownHost[] {
  const result: KnownHost[] = [];

  for (let i = 0; i < hosts.length; i++) {
    const entry = hosts[i];

    if (typeof entry.name !== "string" || entry.name.trim() === "") {
      throw new YodelError(
        `Invalid known host at index ${i}: name must be a non-empty string`,
        "validation_error",
        0,
      );
    }

    let normalized: string;
    try {
      normalized = new URL(entry.url).href;
    } catch {
      throw new YodelError(
        `Invalid known host at index ${i}: invalid URL "${entry.url}"`,
        "validation_error",
        0,
      );
    }

    result.push({ name: entry.name, url: normalized });
  }

  return result;
}
