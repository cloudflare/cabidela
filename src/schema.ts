import { applyJsonPatch, parseJsonPointer } from "./json-patch";
import type { CabidelaOptions } from ".";

// https://json-schema.org/understanding-json-schema/structuring#dollarref
export const parse$ref = (ref: string) => {
  if (typeof ref !== "string") throw new Error("$ref must be a string");
  const [id, fragment = ""] = ref.split("#");
  return {
    $id: id,
    $path: parseJsonPointer(decodeURIComponent(fragment)),
  };
};

const isObject = (value: any) => value !== null && typeof value === "object" && !Array.isArray(value);

function deepMerge(target: any, source: any): any {
  if (Array.isArray(target) && Array.isArray(source)) return structuredClone([...target, ...source]);
  if (!isObject(target) || !isObject(source)) return structuredClone(source);
  const result = structuredClone(target);
  for (const key of Object.keys(source)) {
    setObjectProperty(
      result,
      key,
      Object.hasOwn(target, key) ? deepMerge(target[key], source[key]) : structuredClone(source[key]),
    );
  }
  return result;
}

const setObjectProperty = (object: any, property: string, value: any) =>
  Object.defineProperty(object, property, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });

// Preparation returns unchanged branches by identity. Check every root change
// before writing so a read-only property cannot leave a partially updated schema.
export const replaceObject = (target: any, source: any) => {
  if (target === source) return target;
  const removed = Object.keys(target).filter((key) => !Object.hasOwn(source, key));
  const changed = Object.keys(source).filter((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    return !descriptor || !("value" in descriptor) || !Object.is(descriptor.value, source[key]);
  });
  for (const key of [...removed, ...changed]) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor ? !descriptor.configurable : !Object.isExtensible(target)) {
      throw new Error(`Cannot prepare schema: property '${key}' is not configurable or the schema is not extensible`);
    }
  }
  for (const key of removed) delete target[key];
  for (const key of changed) setObjectProperty(target, key, source[key]);
  return target;
};

const schemaMaps = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
  "dependencies",
]);
const schemaLists = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);
const schemaValues = new Set([
  "items",
  "additionalItems",
  "contains",
  "unevaluatedItems",
  "additionalProperties",
  "unevaluatedProperties",
  "propertyNames",
  "not",
  "if",
  "then",
  "else",
  "contentSchema",
]);
// Cabidela also allows references in keyword values, e.g. maxLength: { $ref: ... }.
// These values are data after dereferencing, not recursively interpreted schemas.
const referenceValues = new Set([
  "type",
  "enum",
  "required",
  "dependentRequired",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minContains",
  "maxContains",
  "minProperties",
  "maxProperties",
]);

// Resolve only schema positions. Literal defaults, enum members, annotations and
// JSON Patch operations remain data. Copy changed branches; never mutate input.
export const resolveSchema = (options: CabidelaOptions, definitions: any, schema: any): any => {
  const active = new Set<any>();
  const reference = (ref: string) => {
    const { $id, $path } = parse$ref(ref);
    let value = Object.hasOwn(definitions, $id) ? definitions[$id] : undefined;
    for (const token of $path) {
      value = value != null && Object.hasOwn(value, token) ? value[token] : undefined;
    }
    if (value === undefined) throw new Error(`Could not resolve '${ref}' $ref`);
    return value;
  };
  const mapValues = (object: any, resolve: (value: any) => any): any => {
    if (object === null || typeof object !== "object") return object;
    let result = object;
    for (const key of Object.keys(object)) {
      const value = resolve(object[key]);
      if (value !== object[key]) {
        if (result === object) result = Array.isArray(object) ? [...object] : { ...object };
        setObjectProperty(result, key, value);
      }
    }
    return result;
  };
  const resolve = (node: any, schemaMap = false): any => {
    if (!isObject(node)) return node;
    if (active.has(node)) throw new Error("Circular schema reference");
    active.add(node);
    try {
      let result = node;
      for (const key of ["$ref", "$merge", "$patch"]) {
        if (!Object.hasOwn(result, key)) continue;
        // Legacy schemas can wrap a whole properties map in an extension.
        // A property named "$patch" whose value is a schema is still a property.
        if (
          schemaMap &&
          (key === "$ref"
            ? typeof result[key] !== "string"
            : !isObject(result[key]) || !Object.hasOwn(result[key], "source") || !Object.hasOwn(result[key], "with"))
        )
          continue;
        if (key === "$merge" && !options.useMerge) continue;
        if (key === "$patch" && !options.usePatch) continue;
        let expanded;
        if (key === "$ref") {
          expanded = resolve(reference(result[key]), schemaMap);
        } else {
          const extension = result[key];
          if (!isObject(extension)) throw new Error(`${key} must be an object`);
          const source = resolve(extension.source, schemaMap);
          expanded =
            key === "$patch"
              ? applyJsonPatch(source, extension.with)
              : deepMerge(source, resolve(extension.with, schemaMap));
          expanded = resolve(expanded, schemaMap);
          if (key === "$patch" && !isObject(expanded)) throw new Error("$patch result must be an object schema");
        }
        if (!isObject(expanded)) return expanded;
        result = { ...result, ...expanded };
        delete result[key];
      }
      return schemaMap ? mapValues(result, resolve) : resolveChildren(result);
    } finally {
      active.delete(node);
    }
  };
  const resolveChildren = (node: any) => {
    let result = node;
    for (const key of Object.keys(node)) {
      const value = node[key];
      let resolved = value;
      if (schemaMaps.has(key)) resolved = resolve(value, true);
      else if (schemaLists.has(key) && Array.isArray(value)) resolved = mapValues(value, resolve);
      else if (schemaValues.has(key)) resolved = Array.isArray(value) ? mapValues(value, resolve) : resolve(value);
      else if (referenceValues.has(key) && isObject(value) && Object.hasOwn(value, "$ref"))
        resolved = reference(value.$ref);
      if (resolved !== value) {
        if (result === node) result = { ...node };
        setObjectProperty(result, key, resolved);
      }
    }
    return result;
  };
  return resolve(schema);
};
