/**
 * Tests for parseKnownHosts — validation, normalization, fail-fast.
 *
 * Covers:
 * - Valid entries → normalized URLs
 * - Empty array → empty array
 * - Empty name → validation_error
 * - Whitespace-only name → validation_error
 * - Invalid URL → validation_error
 * - Fail-fast: valid + invalid → throws on invalid, no further processing
 * - URL normalization: trailing slash, missing path
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseKnownHosts } from "../src/discovery/knownHosts.js";
import { YodelError } from "../src/types/errors.js";

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("parseKnownHosts — happy path", () => {
  it("returns validated entries with normalized URLs", () => {
    const result = parseKnownHosts([
      { name: "Local Ollama", url: "http://localhost:11434" },
      { name: "Cloud", url: "https://api.example.com/v1/" },
    ]);

    assert.equal(result.length, 2);
    assert.equal(result[0].name, "Local Ollama");
    assert.equal(result[0].url, "http://localhost:11434/");
    assert.equal(result[1].name, "Cloud");
    assert.equal(result[1].url, "https://api.example.com/v1/");
  });

  it("returns empty array for empty input", () => {
    const result = parseKnownHosts([]);
    assert.deepEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

describe("parseKnownHosts — URL normalization", () => {
  it("normalizes URLs via new URL().href", () => {
    const result = parseKnownHosts([
      { name: "test", url: "http://EXAMPLE.COM:80/path" },
    ]);

    assert.equal(result[0].url, "http://example.com/path");
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe("parseKnownHosts — validation errors", () => {
  it("throws validation_error for empty name", () => {
    assert.throws(
      () => parseKnownHosts([{ name: "", url: "http://localhost" }]),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        assert.match(err.message, /index 0/);
        assert.match(err.message, /name/);
        return true;
      },
    );
  });

  it("throws validation_error for whitespace-only name", () => {
    assert.throws(
      () => parseKnownHosts([{ name: "   ", url: "http://localhost" }]),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        assert.match(err.message, /name/);
        return true;
      },
    );
  });

  it("throws validation_error for invalid URL", () => {
    assert.throws(
      () => parseKnownHosts([{ name: "bad", url: "not-a-url" }]),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        assert.match(err.message, /URL/);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Fail-fast behavior
// ---------------------------------------------------------------------------

describe("parseKnownHosts — fail-fast", () => {
  it("throws on first invalid entry, skipping subsequent valid entries", () => {
    assert.throws(
      () =>
        parseKnownHosts([
          { name: "good", url: "http://localhost:11434" },
          { name: "", url: "http://localhost:11435" },
          { name: "also good", url: "http://localhost:11436" },
        ]),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        assert.match(err.message, /index 1/);
        return true;
      },
    );
  });
});
