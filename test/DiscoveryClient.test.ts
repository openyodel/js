/**
 * Tests for DiscoveryClient — well-known endpoint fetch, validation, error handling.
 *
 * Covers:
 * - Happy path: valid discovery JSON → parsed YodelDiscovery
 * - Missing yodel_version → validation_error
 * - Missing endpoints → validation_error
 * - HTTP 404 → not_found_error
 * - HTTP 500 → backend_error
 * - Network failure → network_error
 * - Invalid JSON body → validation_error
 * - Response without application/json Content-Type → still parses
 * - Trailing slash in baseUrl → correct URL construction
 * - Agents and optional fields mapping
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DiscoveryClient } from "../src/discovery/DiscoveryClient.js";
import { YodelError } from "../src/types/errors.js";
import { mockFetch, mockJsonResponse } from "./helpers.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_DISCOVERY = {
  yodel_version: 1,
  endpoints: { chat: "/v1/chat/completions" },
  capabilities: ["streaming", "tts"],
  gateway: null,
  agents: [],
};

const VALID_DISCOVERY_FULL = {
  yodel_version: 1,
  endpoints: { chat: "/v1/chat/completions" },
  capabilities: ["streaming"],
  gateway: "yodel-gateway",
  agents: [
    { slug: "helper", name: "Helper Bot", model: "llama3" },
    { slug: "minimal" },
  ],
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("DiscoveryClient — happy path", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("parses a valid discovery response", async () => {
    const { restore: r } = mockFetch(() => mockJsonResponse(VALID_DISCOVERY));
    restore = r;

    const client = new DiscoveryClient();
    const result = await client.discover("http://localhost:11434");

    assert.equal(result.yodelVersion, 1);
    assert.deepEqual(result.endpoints, { chat: "/v1/chat/completions" });
    assert.deepEqual(result.capabilities, ["streaming", "tts"]);
    assert.equal(result.gateway, null);
    assert.deepEqual(result.agents, []);
  });

  it("maps agents and optional fields correctly", async () => {
    const { restore: r } = mockFetch(() => mockJsonResponse(VALID_DISCOVERY_FULL));
    restore = r;

    const client = new DiscoveryClient();
    const result = await client.discover("http://localhost:11434");

    assert.equal(result.gateway, "yodel-gateway");
    assert.equal(result.agents.length, 2);
    assert.deepEqual(result.agents[0], { slug: "helper", name: "Helper Bot", model: "llama3" });
    assert.equal(result.agents[1].slug, "minimal");
    assert.equal(result.agents[1].name, undefined);
    assert.equal(result.agents[1].model, undefined);
  });

  it("defaults capabilities to empty array when missing", async () => {
    const body = { yodel_version: 1, endpoints: { chat: "/chat" } };
    const { restore: r } = mockFetch(() => mockJsonResponse(body));
    restore = r;

    const client = new DiscoveryClient();
    const result = await client.discover("http://localhost:11434");

    assert.deepEqual(result.capabilities, []);
  });
});

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

describe("DiscoveryClient — URL construction", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("strips trailing slash from baseUrl", async () => {
    const { calls, restore: r } = mockFetch(() => mockJsonResponse(VALID_DISCOVERY));
    restore = r;

    const client = new DiscoveryClient();
    await client.discover("http://localhost:11434/");

    assert.equal(calls[0].url, "http://localhost:11434/.well-known/yodel.json");
  });

  it("works without trailing slash", async () => {
    const { calls, restore: r } = mockFetch(() => mockJsonResponse(VALID_DISCOVERY));
    restore = r;

    const client = new DiscoveryClient();
    await client.discover("http://localhost:11434");

    assert.equal(calls[0].url, "http://localhost:11434/.well-known/yodel.json");
  });
});

// ---------------------------------------------------------------------------
// Content-Type tolerance
// ---------------------------------------------------------------------------

describe("DiscoveryClient — Content-Type tolerance", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("parses valid JSON even without application/json Content-Type", async () => {
    const { restore: r } = mockFetch(
      () => mockJsonResponse(VALID_DISCOVERY, 200, "text/plain"),
    );
    restore = r;

    const client = new DiscoveryClient();
    const result = await client.discover("http://localhost:11434");

    assert.equal(result.yodelVersion, 1);
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe("DiscoveryClient — validation errors", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("throws validation_error when yodel_version is missing", async () => {
    const body = { endpoints: { chat: "/chat" } };
    const { restore: r } = mockFetch(() => mockJsonResponse(body));
    restore = r;

    const client = new DiscoveryClient();
    await assert.rejects(
      () => client.discover("http://localhost:11434"),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        assert.match(err.message, /yodel_version/);
        return true;
      },
    );
  });

  it("throws validation_error when yodel_version is not an integer", async () => {
    const body = { yodel_version: "1", endpoints: {} };
    const { restore: r } = mockFetch(() => mockJsonResponse(body));
    restore = r;

    const client = new DiscoveryClient();
    await assert.rejects(
      () => client.discover("http://localhost:11434"),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        return true;
      },
    );
  });

  it("throws validation_error when endpoints is missing", async () => {
    const body = { yodel_version: 1 };
    const { restore: r } = mockFetch(() => mockJsonResponse(body));
    restore = r;

    const client = new DiscoveryClient();
    await assert.rejects(
      () => client.discover("http://localhost:11434"),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        assert.match(err.message, /endpoints/);
        return true;
      },
    );
  });

  it("throws validation_error on invalid JSON body", async () => {
    const { restore: r } = mockFetch(() =>
      new Response("not json", { status: 200 }),
    );
    restore = r;

    const client = new DiscoveryClient();
    await assert.rejects(
      () => client.discover("http://localhost:11434"),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        return true;
      },
    );
  });

  it("throws validation_error on non-object JSON (array)", async () => {
    const { restore: r } = mockFetch(() => mockJsonResponse([1, 2, 3]));
    restore = r;

    const client = new DiscoveryClient();
    await assert.rejects(
      () => client.discover("http://localhost:11434"),
      (err: YodelError) => {
        assert.equal(err.type, "validation_error");
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// HTTP errors
// ---------------------------------------------------------------------------

describe("DiscoveryClient — HTTP errors", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("throws not_found_error on HTTP 404", async () => {
    const { restore: r } = mockFetch(() =>
      new Response("", { status: 404 }),
    );
    restore = r;

    const client = new DiscoveryClient();
    await assert.rejects(
      () => client.discover("http://localhost:11434"),
      (err: YodelError) => {
        assert.equal(err.type, "not_found_error");
        assert.equal(err.status, 404);
        return true;
      },
    );
  });

  it("throws backend_error on HTTP 500", async () => {
    const { restore: r } = mockFetch(() =>
      new Response("", { status: 500 }),
    );
    restore = r;

    const client = new DiscoveryClient();
    await assert.rejects(
      () => client.discover("http://localhost:11434"),
      (err: YodelError) => {
        assert.equal(err.type, "backend_error");
        assert.equal(err.status, 500);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Network errors
// ---------------------------------------------------------------------------

describe("DiscoveryClient — network errors", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("throws network_error on fetch failure", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    restore = () => { globalThis.fetch = original; };

    const client = new DiscoveryClient();
    await assert.rejects(
      () => client.discover("http://localhost:11434"),
      (err: YodelError) => {
        assert.equal(err.type, "network_error");
        assert.equal(err.status, 0);
        assert.match(err.message, /Failed to fetch/);
        return true;
      },
    );
  });
});
