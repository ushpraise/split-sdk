/**
 * Tests for XBullAdapter — focuses on the #771 acceptance criteria:
 * - connect() rejects with ExtensionVersionError when the installed version
 *   is below MIN_XBULL_VERSION.
 * - Compatible versions proceed with the existing connection flow.
 * - MIN_XBULL_VERSION is exported.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  XBullAdapter,
  ExtensionVersionError,
  MIN_XBULL_VERSION,
} from "../src/wallets/adapters/XBullAdapter.js";

const MOCK_PUBLIC_KEY =
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

function makeXBullMock() {
  return {
    connect: vi.fn().mockResolvedValue({ public_key: MOCK_PUBLIC_KEY }),
    sign: vi
      .fn()
      .mockResolvedValue({ xdr: "signed-xdr" }),
    onAccountChange: vi.fn().mockReturnValue(() => {}),
  };
}

describe("XBullAdapter (#771)", () => {
  let adapter: XBullAdapter;

  afterEach(() => {
    vi.unstubAllGlobals();
    adapter?.disconnect();
  });

  // -------------------------------------------------------------------------
  // MIN_XBULL_VERSION is exported
  // -------------------------------------------------------------------------
  it("exports MIN_XBULL_VERSION as a string", () => {
    expect(typeof MIN_XBULL_VERSION).toBe("string");
    expect(MIN_XBULL_VERSION.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Version too old → reject
  // -------------------------------------------------------------------------
  describe("when the installed version is below MIN_XBULL_VERSION", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        xbull: makeXBullMock(),
        xBullSDK: { version: "1.0.0" }, // older than MIN_XBULL_VERSION (2.0.0)
      });
      adapter = new XBullAdapter();
    });

    it("throws ExtensionVersionError from connect()", async () => {
      await expect(adapter.connect()).rejects.toThrow(ExtensionVersionError);
    });

    it("error message contains the required version", async () => {
      try {
        await adapter.connect();
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as Error).message).toContain(MIN_XBULL_VERSION);
      }
    });

    it("error message contains the installed version", async () => {
      try {
        await adapter.connect();
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as Error).message).toContain("1.0.0");
      }
    });

    it("does not call xbull.connect() when version check fails", async () => {
      const xbullMock = (window as any).xbull;
      try {
        await adapter.connect();
      } catch {
        // expected
      }
      expect(xbullMock.connect).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Version equal to minimum → allow
  // -------------------------------------------------------------------------
  describe("when the installed version equals MIN_XBULL_VERSION", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        xbull: makeXBullMock(),
        xBullSDK: { version: MIN_XBULL_VERSION },
      });
      adapter = new XBullAdapter();
    });

    it("connect() resolves successfully", async () => {
      const key = await adapter.connect();
      expect(key).toBe(MOCK_PUBLIC_KEY);
    });
  });

  // -------------------------------------------------------------------------
  // Version above minimum → allow
  // -------------------------------------------------------------------------
  describe("when the installed version is above MIN_XBULL_VERSION", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        xbull: makeXBullMock(),
        xBullSDK: { version: "3.5.1" },
      });
      adapter = new XBullAdapter();
    });

    it("connect() resolves with the public key", async () => {
      const key = await adapter.connect();
      expect(key).toBe(MOCK_PUBLIC_KEY);
    });

    it("does not throw ExtensionVersionError", async () => {
      await expect(adapter.connect()).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // No xBullSDK namespace → skip check (graceful degradation)
  // -------------------------------------------------------------------------
  describe("when window.xBullSDK is not present", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        xbull: makeXBullMock(),
        // xBullSDK intentionally absent
      });
      adapter = new XBullAdapter();
    });

    it("connect() proceeds without throwing a version error", async () => {
      await expect(adapter.connect()).resolves.toBe(MOCK_PUBLIC_KEY);
    });
  });

  // -------------------------------------------------------------------------
  // ExtensionVersionError shape
  // -------------------------------------------------------------------------
  describe("ExtensionVersionError", () => {
    it("has the correct name property", () => {
      const err = new ExtensionVersionError("1.0.0", "2.0.0");
      expect(err.name).toBe("ExtensionVersionError");
    });

    it("is an instance of Error", () => {
      const err = new ExtensionVersionError("1.0.0", "2.0.0");
      expect(err).toBeInstanceOf(Error);
    });

    it("exposes installedVersion and requiredVersion", () => {
      const err = new ExtensionVersionError("1.2.3", "2.0.0");
      expect(err.installedVersion).toBe("1.2.3");
      expect(err.requiredVersion).toBe("2.0.0");
    });
  });

  // -------------------------------------------------------------------------
  // XBullAdapter.compareVersions utility
  // -------------------------------------------------------------------------
  describe("compareVersions()", () => {
    it("returns negative when a < b", () => {
      expect(XBullAdapter.compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
    });

    it("returns 0 when a === b", () => {
      expect(XBullAdapter.compareVersions("2.0.0", "2.0.0")).toBe(0);
    });

    it("returns positive when a > b", () => {
      expect(XBullAdapter.compareVersions("3.1.0", "2.5.9")).toBeGreaterThan(0);
    });

    it("handles minor version differences", () => {
      expect(XBullAdapter.compareVersions("2.1.0", "2.0.0")).toBeGreaterThan(0);
      expect(XBullAdapter.compareVersions("2.0.0", "2.1.0")).toBeLessThan(0);
    });

    it("handles patch version differences", () => {
      expect(XBullAdapter.compareVersions("2.0.1", "2.0.0")).toBeGreaterThan(0);
      expect(XBullAdapter.compareVersions("2.0.0", "2.0.1")).toBeLessThan(0);
    });
  });
});
