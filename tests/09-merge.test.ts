import { expect, describe, test } from "vitest";
import { FakeCabidela } from "./lib/fake-cabidela";
import { Cabidela } from "../src";

describe("$merge", () => {
  test("preserves literal null values and concatenates whole array elements", () => {
    const source = { type: "object", default: null, examples: [{ x: 1 }] };
    const c = new Cabidela({ $merge: { source, with: { default: null, examples: [{ x: 2 }] } } }, { useMerge: true });
    expect(c.getSchema()).toEqual({ type: "object", default: null, examples: [{ x: 1 }, { x: 2 }] });
    expect(source.examples).toEqual([{ x: 1 }]);
  });
  test.skipIf(process.env.AJV)("two objects", () => {
    let schema = {
      $merge: {
        source: {
          type: "object",
          properties: { p: { type: "string" } },
          additionalProperties: false,
        },
        with: {
          properties: { q: { type: "number" } },
        },
      },
    };
    const cabidela = new FakeCabidela(schema, { useMerge: true });
    schema = cabidela.getSchema();
    expect(schema).toStrictEqual({
      type: "object",
      properties: { p: { type: "string" }, q: { type: "number" } },
      additionalProperties: false,
    });
  });

  test.skipIf(process.env.AJV)("two objects, with arrays", () => {
    let schema = {
      $merge: {
        source: {
          type: "object",
          properties: { p: [1, 2] },
        },
        with: {
          properties: { p: [3, 4] },
        },
      },
    };
    const cabidela = new FakeCabidela(schema, { useMerge: true });
    schema = cabidela.getSchema();
    expect(schema).toStrictEqual({
      type: "object",
      properties: { p: [1, 2, 3, 4] },
    });
  });

  test.skipIf(process.env.AJV)("two objects, with $defs and $ref", () => {
    let schema = {
      $merge: {
        source: {
          type: "object",
          properties: { p: { type: "string" } },
          additionalProperties: false,
        },
        with: {
          properties: {
            q: {
              type: "string",
              maxLength: { $ref: "$defs#/max_tokens" },
            },
          },
        },
      },
      $defs: {
        max_tokens: 250,
      },
    };
    const cabidela = new FakeCabidela(schema, { useMerge: true });
    schema = cabidela.getSchema();
    expect(schema).toStrictEqual({
      type: "object",
      properties: { p: { type: "string" }, q: { type: "string", maxLength: 250 } },
      additionalProperties: false,
    });
  });
});
