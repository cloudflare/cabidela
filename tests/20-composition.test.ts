import { expect, test, describe, it } from "vitest";
import { FakeCabidela } from "./lib/fake-cabidela";
import { Cabidela } from "../src";

describe("composition branch results", () => {
  test.each(["anyOf", "oneOf"])("%s does not count a scalar as an object or array", (keyword) => {
    const c = new Cabidela({ [keyword]: [{ type: "object" }, { type: "array", items: { type: "string" } }] });
    expect(c.validate({})).toBe(true);
    expect(c.validate([])).toBe(true);
    for (const value of [42, true, null, "text"]) expect(() => c.validate(value)).toThrow();
  });
  test.each([false, true])("leaves absent optional composed properties absent (defaults=%s)", (applyDefaults) => {
    for (const keyword of ["anyOf", "oneOf", "allOf"]) {
      const c = new Cabidela(
        {
          type: "object",
          properties: {
            x: { [keyword]: [{ type: "string" }, { type: "number" }] },
            y: { not: { type: "string" } },
          },
        },
        { applyDefaults },
      );
      const payload = {};
      expect(c.validate(payload)).toBe(true);
      expect(payload).toEqual({});
      expect(() => c.validate({ x: true })).toThrow();
    }
  });
  test.each([{ payload: [] }, { payload: [{ x: "a" }, { x: "b" }] }])(
    "counts an array as one matching branch: %j",
    ({ payload }) => {
      const c = new Cabidela({
        oneOf: [{ type: "array", items: { type: "object", properties: { x: { type: "string" } }, required: ["x"] } }],
      });
      expect(c.validate(payload)).toBe(true);
    },
  );

  test("counts a valid empty object as a matching branch", () => {
    expect(new Cabidela({ oneOf: [{ type: "object" }] }).validate({})).toBe(true);
    expect(() => new Cabidela({ oneOf: [{ type: "object" }, { type: "object" }] }).validate({})).toThrowError(
      "2 matches found",
    );
  });

  test.each(["anyOf", "oneOf", "allOf"])("propagates a nested %s failure", (keyword) => {
    const c = new Cabidela({
      type: "object",
      properties: { x: { anyOf: [{ [keyword]: [{ type: "string" }] }] } },
      required: ["x"],
    });
    expect(c.validate({ x: "valid" })).toBe(true);
    expect(() => c.validate({ x: 42 })).toThrow();
  });

  test.each(["anyOf", "oneOf", "allOf"])("reports invalid optional properties using %s", (keyword) => {
    const c = new Cabidela({ type: "object", properties: { x: { [keyword]: [{ type: "string" }] } } });
    expect(() => c.validate({ x: 42 })).toThrow();
  });
});

describe("allOf, two properties", () => {
  let schema = {
    allOf: [{ type: "string" }, { maxLength: 5 }],
  };

  let validator = new FakeCabidela(schema);

  it("short string", () => {
    expect(() => validator.validate("short")).not.toThrowError();
  });
  it("long string", () => {
    expect(() => validator.validate("too long")).toThrowError();
  });
});

describe("allOf, two objects", () => {
  let schema = {
    type: "object",
    allOf: [
      {
        properties: {
          string: {
            type: "string",
          },
        },
      },
      {
        properties: {
          number: {
            type: "number",
          },
        },
      },
    ],
  };
  let validator = new FakeCabidela(schema);

  it("string is string, number is number", () => {
    expect(() => validator.validate({ string: "string", number: 10 })).not.toThrowError();
  });
  it("string is string, number is string", () => {
    expect(() => validator.validate({ string: "string", number: "string" })).toThrowError();
  });
});

describe("anyOf, two conditions", () => {
  let schema = {
    anyOf: [
      { type: "string", maxLength: 5 },
      { type: "number", minimum: 0 },
    ],
  };

  let validator = new FakeCabidela(schema);

  it("short string", () => {
    expect(() => validator.validate("short")).not.toThrowError();
  });
  it("too long string", () => {
    expect(() => validator.validate("too long")).toThrowError();
  });
  it("bigger than 0 number", () => {
    expect(() => validator.validate(12)).not.toThrowError();
  });
  it("negative number", () => {
    expect(() => validator.validate(-5)).toThrowError();
  });
});

describe("oneOf, two conditions", () => {
  let schema = {
    oneOf: [
      { type: "number", multipleOf: 5 },
      { type: "number", multipleOf: 3 },
    ],
  };

  let validator = new FakeCabidela(schema);

  it("number is multipleOf", () => {
    expect(() => validator.validate(5)).not.toThrowError();
  });
  it("number is multipleOf", () => {
    expect(() => validator.validate(9)).not.toThrowError();
  });
  it("number is not multipleOf", () => {
    expect(() => validator.validate(2)).toThrowError();
  });
});
