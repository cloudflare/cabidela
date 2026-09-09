import { describe, expect, test } from "vitest";
import { applyJsonPatch } from "../src/json-patch";

describe("JSON Patch operations", () => {
  test("applies object edits in order", () => {
    const source = { title: "draft", obsolete: true };
    expect(
      applyJsonPatch(source, [
        { op: "add", path: "/title", value: "review" },
        { op: "copy", from: "/title", path: "/previous" },
        { op: "replace", path: "/title", value: "published" },
        { op: "move", from: "/previous", path: "/history" },
        { op: "remove", path: "/obsolete" },
        { op: "test", path: "/history", value: "review" },
      ]),
    ).toEqual({ title: "published", history: "review" });
    expect(source).toEqual({ title: "draft", obsolete: true });
  });

  test.each([
    [{ op: "add", path: "/0", value: "new" }, ["new", "red", "blue", "green"]],
    [{ op: "add", path: "/1", value: "new" }, ["red", "new", "blue", "green"]],
    [{ op: "add", path: "/3", value: "new" }, ["red", "blue", "green", "new"]],
    [{ op: "add", path: "/-", value: "new" }, ["red", "blue", "green", "new"]],
    [{ op: "remove", path: "/1" }, ["red", "green"]],
    [{ op: "replace", path: "/1", value: "new" }, ["red", "new", "green"]],
    [{ op: "move", from: "/0", path: "/2" }, ["blue", "green", "red"]],
    [{ op: "move", from: "/2", path: "/0" }, ["green", "red", "blue"]],
    [{ op: "move", from: "/1", path: "/1" }, ["red", "blue", "green"]],
    [{ op: "copy", from: "/0", path: "/-" }, ["red", "blue", "green", "red"]],
  ] as const)("edits arrays with %j", (operation, expected) => {
    const source = ["red", "blue", "green"];
    expect(applyJsonPatch(source, [operation])).toEqual(expected);
    expect(source).toEqual(["red", "blue", "green"]);
  });

  test.each(["add", "replace"] as const)("%s isolates inserted values and the source", (op) => {
    const source = { settings: { enabled: false } };
    const value = { enabled: true };
    const result = applyJsonPatch(source, [{ op, path: "/settings", value }]);
    expect(result).toEqual({ settings: { enabled: true } });
    result.settings.enabled = false;
    expect(value).toEqual({ enabled: true });
    expect(source).toEqual({ settings: { enabled: false } });
    expect(result).not.toBe(source);
  });

  test("copies nested values independently", () => {
    const source = { original: { tags: ["ready"] } };
    const result = applyJsonPatch(source, [
      { op: "copy", from: "/original", path: "/copy" },
      { op: "add", path: "/copy/tags/-", value: "reviewed" },
    ]);
    expect(result).toEqual({ original: { tags: ["ready"] }, copy: { tags: ["ready", "reviewed"] } });
    result.original.tags.push("changed");
    expect(source).toEqual({ original: { tags: ["ready"] } });
  });

  test("decodes escaped tokens once and addresses empty member names", () => {
    expect(
      applyJsonPatch({ "a/b": { "~key": { "": 1 } }, "~1": 2 }, [
        { op: "replace", path: "/a~1b/~0key/", value: 3 },
        { op: "move", from: "/~01", path: "/" },
      ]),
    ).toEqual({ "a/b": { "~key": { "": 3 } }, "": 2 });
  });

  test.each([[null], [false], [7], ["ready"], [[1, 2]], [{ "": "member" }]])(
    "supports the JSON root value %j",
    (value) => {
      expect(applyJsonPatch(value, [{ op: "test", path: "", value }])).toEqual(value);
      expect(applyJsonPatch({}, [{ op: "add", path: "", value }])).toEqual(value);
      expect(applyJsonPatch({}, [{ op: "replace", path: "", value }])).toEqual(value);
      expect(applyJsonPatch(value, [{ op: "remove", path: "" }])).toBeUndefined();
    },
  );

  test.each(["copy", "move"] as const)("%s can make a member the root", (op) => {
    expect(applyJsonPatch({ value: [1, 2] }, [{ op, from: "/value", path: "" }])).toEqual([1, 2]);
  });

  test("can copy the root into a member without creating a cycle", () => {
    expect(applyJsonPatch({ value: 1 }, [{ op: "copy", from: "", path: "/snapshot" }])).toEqual({
      value: 1,
      snapshot: { value: 1 },
    });
  });

  test.each([
    [{ first: 1, second: [null, true] }, { second: [null, true], first: 1 }, true],
    [[1, 2], [2, 1], false],
    [[1], { "0": 1 }, false],
    [{ nested: { value: 1 } }, { nested: { value: "1" } }, false],
    [{ value: null }, {}, false],
  ])("compares %j with %j structurally", (source, value, equal) => {
    const apply = () => applyJsonPatch(source, [{ op: "test", path: "", value }]);
    if (equal) expect(apply()).toEqual(source);
    else expect(apply).toThrowError("test failed");
  });

  test.each(["01", "-1", "1.5", "4", "word", ""])("rejects invalid array index %j", (index) => {
    const source = ["red", "blue", "green"];
    expect(() => applyJsonPatch(source, [{ op: "add", path: `/${index}`, value: "new" }])).toThrow();
    expect(() => applyJsonPatch(source, [{ op: "remove", path: `/${index}` }])).toThrow();
    expect(() => applyJsonPatch(source, [{ op: "test", path: `/${index}`, value: "red" }])).toThrow();
  });

  test.each(["/3", "/-"])("requires an existing array element at %s", (path) => {
    const source = ["red", "blue", "green"];
    expect(() => applyJsonPatch(source, [{ op: "remove", path }])).toThrow();
    expect(() => applyJsonPatch(source, [{ op: "replace", path, value: "new" }])).toThrow();
    expect(() => applyJsonPatch(source, [{ op: "copy", from: path, path: "/0" }])).toThrow();
    expect(() => applyJsonPatch(source, [{ op: "move", from: path, path: "/0" }])).toThrow();
  });

  test.each([
    { op: "add", path: "/missing/child", value: 1 },
    { op: "add", path: "/leaf/child", value: 1 },
    { op: "add", path: "/__proto__/child", value: 1 },
    { op: "remove", path: "/missing" },
    { op: "replace", path: "/missing", value: 1 },
    { op: "test", path: "/missing", value: null },
    { op: "copy", from: "/missing", path: "/copy" },
    { op: "move", from: "/missing", path: "/moved" },
  ] as const)("requires existing targets and container parents for %j", (operation) => {
    expect(() => applyJsonPatch({ leaf: null }, [operation])).toThrow();
  });

  test.each([null, {}, "invalid"])("rejects a non-array operation list %j", (operations) => {
    expect(() => applyJsonPatch({}, operations as any)).toThrowError("must be an array");
  });

  test.each([
    null,
    {},
    { op: "splice", path: "" },
    { op: "remove" },
    { op: "remove", path: 0 },
    { op: "add", path: "" },
    { op: "replace", path: "" },
    { op: "test", path: "" },
    { op: "copy", path: "" },
    { op: "move", path: "" },
    { op: "copy", from: null, path: "" },
    { op: "move", from: 0, path: "" },
  ])("rejects malformed operation %j", (operation) => {
    expect(() => applyJsonPatch({}, [operation as any])).toThrow();
  });

  test.each(["__proto__", "constructor", "prototype", "hasOwnProperty"])("safely writes the member %s", (key) => {
    const result = applyJsonPatch({}, [{ op: "add", path: `/${key}`, value: { safe: true } }]);
    expect(Object.hasOwn(result, key)).toBe(true);
    expect(result[key]).toEqual({ safe: true });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, "safe")).toBe(false);
  });

  test.each(["/~", "/~2", "relative"])("rejects invalid JSON Pointer %s", (path) => {
    expect(() => applyJsonPatch({}, [{ op: "add", path, value: 1 }])).toThrowError("Invalid JSON Pointer");
    expect(() => applyJsonPatch({}, [{ op: "copy", from: path, path: "/copy" }])).toThrowError("Invalid JSON Pointer");
  });

  test("rejects moving an ancestor into its descendant without mutating input", () => {
    const source = { a: { b: {} } };
    expect(() => applyJsonPatch(source, [{ op: "move", from: "/a", path: "/a/b/c" }])).toThrow();
    expect(source).toEqual({ a: { b: {} } });
  });

  test("rolls back the whole operation sequence on failure", () => {
    const source = { enum: ["low", "medium", "high"] };
    expect(() =>
      applyJsonPatch(source, [
        { op: "remove", path: "/enum/1" },
        { op: "test", path: "/enum/0", value: "unexpected" },
      ]),
    ).toThrowError("test failed");
    expect(source.enum).toEqual(["low", "medium", "high"]);
  });
});
