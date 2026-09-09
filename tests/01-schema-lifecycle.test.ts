import { describe, expect, test } from "vitest";
import { Cabidela } from "../src";

const input = () => ({ $id: "https://example.com/input", type: "string" });

describe("schema preparation", () => {
  test("addSchema resolves references without enabling extensions", () => {
    const c = new Cabidela({ $ref: "input#" });
    c.addSchema(input());
    expect(c.validate("valid")).toBe(true);
    expect(() => c.validate(42)).toThrow();
    c.setSchema({ $ref: "input" });
    expect(() => c.validate(42)).toThrow();
  });

  test("addSchema can defer resolution until the next preparation", () => {
    const schema = { $ref: "input#" };
    const c = new Cabidela(schema);
    c.addSchema(input(), false);
    expect(c.getSchema()).toEqual({ $ref: "input#" });
    c.setOptions({});
    expect(c.getSchema()).toBe(schema);
    expect(() => c.validate(42)).toThrow();
  });

  test("resolves local definitions without extension flags", () => {
    const c = new Cabidela({ $defs: { input: { type: "string" } }, $ref: "$defs#/input" });
    expect(() => c.validate(42)).toThrow();
    c.setSchema({ $defs: { input: { type: "number" } }, $ref: "$defs#/input" });
    expect(c.validate(42)).toBe(true);
  });

  test.each([{}, { usePatch: true }, { useMerge: true }])("preserves frozen, unchanged schemas with %j", (options) => {
    const schema = Object.freeze({ type: "string", title: "Example" });
    const c = new Cabidela(schema, options);
    c.setOptions({ fullErrors: false });
    c.setSchema(schema);
    expect(c.getSchema()).toBe(schema);
    expect(() => c.validate(42)).toThrow();
  });

  test("preserves unchanged descriptors when another field changes", () => {
    const schema = { title: "Example", $patch: { source: { type: "string" }, with: [] } };
    Object.defineProperty(schema, "title", { configurable: false, writable: false });
    const c = new Cabidela(schema, { usePatch: true });
    expect(c.getSchema()).toBe(schema);
    expect(Object.getOwnPropertyDescriptor(schema, "title")).toMatchObject({ configurable: false, writable: false });
    expect(() => c.validate(42)).toThrow();
  });

  test.each(["constructor", "setSchema", "setOptions"])("%s preflights all writes before mutating", (operation) => {
    const schema = {
      type: "string",
      $patch: { source: { type: "number" }, with: [] },
    };
    Object.defineProperty(schema, "type", { configurable: false });
    const before = Object.getOwnPropertyDescriptors(schema);
    const c = new Cabidela(operation === "setOptions" ? schema : { type: "string" });
    const active = c.getSchema();
    if (operation === "setSchema") c.setOptions({ usePatch: true });
    const update = () => {
      if (operation === "constructor") new Cabidela(schema, { usePatch: true });
      else if (operation === "setSchema") c.setSchema(schema);
      else c.setOptions({ usePatch: true });
    };
    expect(update).toThrowError("Cannot prepare schema");
    expect(Object.getOwnPropertyDescriptors(schema)).toEqual(before);
    expect(c.getSchema()).toBe(active);
    expect(() => c.validate(42)).toThrow();
    if (operation === "setOptions") {
      // A failed update must not retain usePatch: true.
      expect(() => c.setOptions({ fullErrors: false })).not.toThrow();
    }
  });

  test("does not delete an extension before discovering a non-extensible root", () => {
    const schema = Object.preventExtensions({ $patch: { source: { type: "string" }, with: [] } });
    const before = structuredClone(schema);
    expect(() => new Cabidela(schema, { usePatch: true })).toThrowError("Cannot prepare schema");
    expect(schema).toEqual(before);
  });

  test("a failed addSchema commit does not retain the registration", () => {
    const schema = { $ref: "input#", type: "string" };
    Object.defineProperty(schema, "type", { configurable: false });
    const c = new Cabidela(schema);
    expect(() => c.addSchema({ ...input(), type: "number" })).toThrowError("Cannot prepare schema");
    expect(c.getSchema()).toEqual({ $ref: "input#", type: "string" });
    expect(() => c.setOptions({ usePatch: true })).toThrowError("Could not resolve 'input#' $ref");
    expect(() => c.validate(42)).toThrow();
  });

  test("references use own definition names and decode JSON Pointer tokens", () => {
    const c = new Cabidela(
      { $ref: "__proto__#/a~1b~0c" },
      {
        subSchemas: [{ $id: "https://example.com/__proto__", "a/b~c": { type: "string" } }],
      },
    );
    expect(() => c.validate(42)).toThrow();
    expect(() => new Cabidela({ $ref: "toString#" }, { usePatch: true })).toThrowError("Could not resolve");
  });

  test("rejects circular references without mutating the supplied schema", () => {
    const schema = { $defs: { a: { $ref: "$defs#/b" }, b: { $ref: "$defs#/a" } }, $ref: "$defs#/a" };
    const before = structuredClone(schema);
    expect(() => new Cabidela(schema)).toThrowError("Circular schema reference");
    expect(schema).toEqual(before);
  });
});
