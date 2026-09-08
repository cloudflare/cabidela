import { expect, describe, test } from "vitest";
import { FakeCabidela } from "./lib/fake-cabidela";

describe("$patch", () => {
  test.skipIf(process.env.AJV)("two objects", () => {
    let schema = {
      $patch: {
        source: {
          type: "object",
          properties: {
            p: { type: "string" },
            q: { type: "number" },
          },
          additionalProperties: false,
        },
        with: {
          properties: { q: null },
        },
      },
    };
    const cabidela = new FakeCabidela(schema, { usePatch: true });
    schema = cabidela.getSchema();
    expect(schema).toStrictEqual({
      type: "object",
      properties: {
        p: { type: "string" },
      },
      additionalProperties: false,
    });
  });
});
