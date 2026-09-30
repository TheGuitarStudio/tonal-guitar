import { afterEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "./clipboard";

describe("copyToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes the text when the Clipboard API is available", () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    copyToClipboard("hello");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("is a no-op without the Clipboard API", () => {
    vi.stubGlobal("navigator", {});
    expect(() => copyToClipboard("hello")).not.toThrow();
  });

  it("attaches a rejection handler to writeText's promise", () => {
    const catchSpy = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText: () => ({ catch: catchSpy }) } });
    copyToClipboard("hello");
    expect(catchSpy).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not surface a rejected write", async () => {
    // Vitest fails the run on an unhandled rejection, so this would error
    // if the rejection escaped.
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    expect(() => copyToClipboard("hello")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
