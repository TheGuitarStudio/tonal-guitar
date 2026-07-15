import { describe, expect, it } from "vitest";
import { displayRootFor } from "./audit";
import type { AuditSeverity, ShapeAuditIssue, ShapeAuditOptions } from "./audit";
import {
  displayRootFor as displayRootForFromIndex,
  VERSION as VERSION_FROM_INDEX,
} from "./index";
import type {
  AuditSeverity as AuditSeverityFromIndex,
  ShapeAuditIssue as ShapeAuditIssueFromIndex,
  ShapeAuditOptions as ShapeAuditOptionsFromIndex,
} from "./index";
import { VERSION } from "./version";

describe("displayRootFor", () => {
  it("returns canonicalRoot when set", () => {
    expect(displayRootFor({ canonicalRoot: "C" })).toBe("C");
  });

  it("returns canonicalRoot for a non-C root", () => {
    expect(displayRootFor({ canonicalRoot: "G" })).toBe("G");
  });

  it("defaults to 'C' when canonicalRoot is absent", () => {
    expect(displayRootFor({})).toBe("C");
  });

  it("defaults to 'C' when canonicalRoot is explicitly undefined", () => {
    expect(displayRootFor({ canonicalRoot: undefined })).toBe("C");
  });
});

describe("audit scaffolding — type-only compile checks", () => {
  it("resolves AuditSeverity, ShapeAuditIssue, ShapeAuditOptions from ./audit", () => {
    const severity: AuditSeverity = "warning";
    const issue: ShapeAuditIssue = {
      id: "fret-span",
      severity,
      message: "example",
    };
    const options: ShapeAuditOptions = {
      root: "C",
      tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
      maxFretSpan: 4,
    };
    expect(issue.id).toBe("fret-span");
    expect(options.maxFretSpan).toBe(4);
  });

  it("resolves AuditSeverity, ShapeAuditIssue, ShapeAuditOptions from ./index", () => {
    const severity: AuditSeverityFromIndex = "error";
    const issue: ShapeAuditIssueFromIndex = {
      id: "geometry-mismatch",
      severity,
      message: "example",
      details: { span: 5 },
    };
    const options: ShapeAuditOptionsFromIndex = {};
    expect(issue.severity).toBe("error");
    expect(options.root).toBeUndefined();
  });

  it("exposes displayRootFor identically from ./audit and ./index", () => {
    expect(typeof displayRootFor).toBe("function");
    expect(typeof displayRootForFromIndex).toBe("function");
    expect(displayRootForFromIndex({ canonicalRoot: "D" })).toBe("D");
    expect(displayRootForFromIndex({})).toBe("C");
  });
});

describe("VERSION", () => {
  it("is exported from ./version as \"0.1.0\"", () => {
    expect(VERSION).toBe("0.1.0");
  });

  it("is re-exported from ./index and matches ./version", () => {
    expect(VERSION_FROM_INDEX).toBe("0.1.0");
    expect(VERSION_FROM_INDEX).toBe(VERSION);
  });
});
