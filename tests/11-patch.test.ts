import { expect, describe, test } from "vitest";
import { Cabidela } from "../src";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

describe("$patch", () => {
  test("is opt-in and preserves the supplied schema until enabled", () => {
    const schema = { $patch: { source: { type: "string" }, with: [] } };
    const c = new Cabidela(schema);
    expect(c.getSchema()).toBe(schema);
    expect(schema).toHaveProperty("$patch");
    c.setOptions({ usePatch: true });
    expect(c.getSchema()).toBe(schema);
    expect(() => c.validate(42)).toThrow();
  });

  test("narrows an enum from a local reference (README example)", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const example = readme.split("## $patch")[1].match(/const schema = ([\s\S]*?);/);
    expect(example).not.toBeNull();
    const schema = runInNewContext(`(${example![1]})`);
    const c = new Cabidela(schema, { usePatch: true });
    expect(c.validate({ reasoning_effort: "high" })).toBe(true);
    expect(() => c.validate({ reasoning_effort: "medium" })).toThrowError("enum");
  });

  test("preserves literal values and ignores extra operation members", () => {
    const literal = { $ref: "literal", $patch: { type: "string" } };
    const c = new Cabidela(
      {
        $patch: {
          source: { type: "object", default: literal, examples: [literal], "x-annotation": literal },
          with: [
            { op: "test", path: "/default", value: literal },
            { op: "add", path: "/const", value: literal, ignored: { $ref: "not-a-reference" } },
            { op: "add", path: "/enum", value: [literal] },
          ],
        },
      },
      { usePatch: true },
    );
    expect(c.getSchema()).toEqual({
      type: "object",
      default: literal,
      examples: [literal],
      "x-annotation": literal,
      const: literal,
      enum: [literal],
    });
  });

  test.each(["$patch", "$merge", "$ref", "constructor", "__proto__", "hasOwnProperty"])(
    "preserves the property name %s",
    (name) => {
      const c = new Cabidela(
        {
          $patch: {
            source: { type: "object", properties: { [name]: { type: "string" } }, required: [name] },
            with: [{ op: "add", path: `/properties/${name}/maxLength`, value: 3 }],
          },
        },
        { usePatch: true, useMerge: true },
      );
      expect(c.validate({ [name]: "yes" })).toBe(true);
      expect(() => c.validate({ [name]: "too long" })).toThrow();
      expect(Object.hasOwn(c.getSchema().properties, name)).toBe(true);
      expect(Object.getPrototypeOf(c.getSchema().properties)).toBe(Object.prototype);
    },
  );

  test("resolves schemas inserted by patch operations, after applying the operations", () => {
    const c = new Cabidela(
      {
        $defs: { name: { type: "string" } },
        $patch: {
          source: { type: "object", properties: {} },
          with: [
            { op: "add", path: "/properties/name", value: { $ref: "$defs#/name" } },
            { op: "test", path: "/properties/name/$ref", value: "$defs#/name" },
          ],
        },
      },
      { usePatch: true },
    );
    expect(c.validate({ name: "valid" })).toBe(true);
    expect(() => c.validate({ name: 42 })).toThrow();
  });

  test("combines nested merge and patch extensions without modifying definitions", () => {
    const base = { $id: "https://example.com/input", type: "string", enum: ["low", "medium", "high"] };
    const c = new Cabidela(
      {
        type: "object",
        properties: {
          effort: {
            $patch: {
              source: { $merge: { source: { $ref: "input" }, with: { default: "high" } } },
              with: [{ op: "remove", path: "/enum/1" }],
            },
          },
          original: { $ref: "input" },
        },
      },
      { usePatch: true, useMerge: true, subSchemas: [base] },
    );
    expect(c.validate({ effort: "high", original: "medium" })).toBe(true);
    expect(() => c.validate({ effort: "medium" })).toThrow();
    expect(base.enum).toEqual(["low", "medium", "high"]);
  });

  test("supports a patch wrapping an entire properties map", () => {
    const c = new Cabidela(
      {
        type: "object",
        properties: {
          $patch: {
            source: { p: { type: "string" }, q: { type: "number" } },
            with: [{ op: "remove", path: "/q" }],
          },
        },
        additionalProperties: false,
      },
      { usePatch: true },
    );
    expect(c.validate({ p: "valid" })).toBe(true);
    expect(() => c.validate({ q: 42 })).toThrow();
  });

  test("applies JSON Patch operations", () => {
    let schema = {
      $patch: {
        source: {
          type: "object",
          properties: {
            effort: { type: "string", enum: ["low", "medium", "high"] },
            obsolete: { type: "boolean" },
          },
          required: ["effort"],
        },
        with: [
          { op: "replace", path: "/properties/effort/enum", value: ["low", "medium", "high", "max", null] },
          { op: "add", path: "/properties/effort/default", value: "max" },
          { op: "remove", path: "/properties/obsolete" },
          { op: "copy", from: "/properties/effort", path: "/properties/copied_effort" },
          { op: "move", from: "/required/0", path: "/required/0" },
          { op: "test", path: "/properties/effort/default", value: "max" },
        ],
      },
    };
    const cabidela = new Cabidela(schema, { usePatch: true });
    schema = cabidela.getSchema();
    expect(schema).toStrictEqual({
      type: "object",
      properties: {
        effort: { type: "string", enum: ["low", "medium", "high", "max", null], default: "max" },
        copied_effort: { type: "string", enum: ["low", "medium", "high", "max", null], default: "max" },
      },
      required: ["effort"],
    });
  });

  test("resolves references before applying a patch", () => {
    let schema = {
      $patch: {
        source: { $ref: "$defs#/input" },
        with: [{ op: "replace", path: "/properties/effort/enum", value: ["low", "high"] }],
      },
      $defs: {
        input: {
          type: "object",
          properties: { effort: { type: "string", enum: ["low", "medium", "high"] } },
        },
      },
    };
    const cabidela = new Cabidela(schema, { usePatch: true });
    schema = cabidela.getSchema();
    expect(schema).toStrictEqual({
      type: "object",
      properties: { effort: { type: "string", enum: ["low", "high"] } },
    });
  });

  test("rejects a failed test operation", () => {
    const schema = {
      $patch: {
        source: { type: "string" },
        with: [{ op: "test", path: "/type", value: "number" }],
      },
    };
    expect(() => new Cabidela(schema, { usePatch: true })).toThrowError("JSON patch test failed at '/type'");
  });

  test.each([
    { $patch: { with: [] } },
    { $patch: { source: { type: "string" }, with: [{ op: "remove", path: "" }] } },
    { $patch: { source: { type: "string" }, with: [{ op: "replace", path: "", value: false }] } },
    {
      $defs: { input: false },
      $patch: { source: {}, with: [{ op: "replace", path: "", value: { $ref: "$defs#/input" } }] },
    },
  ])("rejects a patch that does not produce an object schema", (schema) => {
    expect(() => new Cabidela(schema, { usePatch: true })).toThrowError("$patch result must be an object schema");
  });

  test("resolves patches installed through setSchema", () => {
    const cabidela = new Cabidela({ type: "string" }, { usePatch: true });

    cabidela.setSchema({
      $patch: {
        source: { type: "string", enum: ["low", "high"] },
        with: [{ op: "add", path: "/enum/-", value: "max" }],
      },
    });

    expect(cabidela.getSchema()).toStrictEqual({ type: "string", enum: ["low", "high", "max"] });
    expect(() => cabidela.validate("max")).not.toThrow();
  });

  test("resolves existing patches when setOptions enables them", () => {
    const cabidela = new Cabidela({
      $patch: {
        source: { type: "string", enum: ["low", "high"] },
        with: [{ op: "add", path: "/enum/-", value: "max" }],
      },
    });

    cabidela.setOptions({ usePatch: true });

    expect(cabidela.getSchema()).toStrictEqual({ type: "string", enum: ["low", "high", "max"] });
    expect(() => cabidela.validate("max")).not.toThrow();
  });

  test("retains the active schema when setSchema preparation fails", () => {
    const cabidela = new Cabidela({ type: "string" }, { usePatch: true });

    expect(() =>
      cabidela.setSchema({
        $patch: {
          source: { type: "object" },
          with: [{ op: "remove", path: "/missing" }],
        },
      }),
    ).toThrowError("JSON Pointer '/missing' does not exist");

    expect(cabidela.getSchema()).toStrictEqual({ type: "string" });
    expect(() => cabidela.validate(42)).toThrow();
  });

  test("does not retain an invalid added schema", () => {
    const cabidela = new Cabidela({ type: "string" });

    expect(() => cabidela.addSchema({ type: "object" })).toThrowError("subSchemas need $id");
    expect(() => cabidela.setSchema({ type: "number" })).not.toThrow();
    expect(() => cabidela.validate(42)).not.toThrow();
  });

  test("does not retain invalid options", () => {
    const cabidela = new Cabidela({ type: "string" });

    expect(() => cabidela.setOptions({ subSchemas: [{ type: "object" }] })).toThrowError("subSchemas need $id");
    expect(() => cabidela.setSchema({ type: "number" })).not.toThrow();
    expect(() => cabidela.validate(42)).not.toThrow();
  });

  test.each(["__proto__", "constructor", "prototype"])("adds %s as an own JSON Pointer member", (property) => {
    const cabidela = new Cabidela(
      {
        $patch: {
          source: { type: "object", properties: {} },
          with: [{ op: "add", path: `/properties/${property}`, value: { type: "string" } }],
        },
      },
      { usePatch: true },
    );
    const properties = cabidela.getSchema().properties;

    expect(Object.hasOwn(properties, property)).toBe(true);
    expect(properties[property]).toStrictEqual({ type: "string" });
    expect(Object.getPrototypeOf(properties)).toBe(Object.prototype);
  });

  test.each(["__proto__", "constructor", "prototype"])("adds %s as an own root member", (property) => {
    const cabidela = new Cabidela(
      {
        $patch: {
          source: {},
          with: [{ op: "add", path: `/${property}`, value: { type: "string" } }],
        },
      },
      { usePatch: true },
    );
    const schema = cabidela.getSchema();

    expect(Object.hasOwn(schema, property)).toBe(true);
    expect(schema[property]).toStrictEqual({ type: "string" });
    expect(Object.getPrototypeOf(schema)).toBe(Object.prototype);
  });
});
