import type { CabidelaOptions } from ".";

export type metaData = {
  types: Set<string>;
  size: number;
  properties: Array<string>;
};

export type resolvedResponse = {
  metadata: metaData;
  resolvedObject: any;
};

export const includesAll = (arr: Array<any>, values: Array<any>) => {
  return values.every((v) => arr.includes(v));
};

// https://json-schema.org/understanding-json-schema/structuring#dollarref
export const parse$ref = (ref: string) => {
  const parts = ref.split("#");
  return {
    $id: parts[0],
    $path: parts[1].split("/").filter((part: string) => part != ""),
  };
};

function deepMerge(target: any, source: any) {
  const result = Array(target) && Array.isArray(source) ? target.concat(source) : { ...target, ...source };
  for (const key of Object.keys(result)) {
    result[key] =
      typeof target[key] == "object" && typeof source[key] == "object"
        ? deepMerge(target[key], source[key])
        : structuredClone(result[key]);
  }
  return result;
}

function deepPatch(target: any, source: any) {
  const result = { ...target };
  for (const key of Object.keys(target)) {
    if (typeof target[key] == "object" && typeof source[key] == "object") {
      const patch = deepPatch(target[key], source[key]);
      if (patch) result[key] = patch;
      else delete result[key];
    } else if (source === null) {
      return null;
    } else {
      result[key] = structuredClone(result[key]);
    }
  }
  return result;
}

export const traverseSchema = (options: CabidelaOptions, definitions: any, obj: any) => {
  const ts = (obj: any, cb?: any) => {
    let hits: number;
    if (!obj) return;
    do {
      hits = 0;
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] == "object") {
          ts(obj[key], (value: any) => {
            obj[key] = value;
            hits++;
          });
          if (options.useMerge && key == "$merge") {
            const merge = deepMerge(obj[key].source, obj[key].with);
            if (cb) {
              cb(merge);
            } else {
              // root level
              hits++;
              Object.assign(obj, merge);
              delete obj[key];
            }
          }
          if (options.usePatch && key == "$patch") {
            const merge = deepPatch(obj[key].source, obj[key].with);
            if (cb) {
              cb(merge);
            } else {
              // root level
              Object.assign(obj, merge);
              delete obj[key];
            }
          }
        } else {
          if (key == "$ref") {
            const { $id, $path } = parse$ref(obj[key]);
            const { resolvedObject } = resolvePayload($path, definitions[$id]);
            if (resolvedObject) {
              if (cb) {
                cb(resolvedObject);
              } else {
                // root level
                hits++;
                Object.assign(obj, resolvedObject);
                delete obj[key];
              }
            } else {
              throw new Error(`Could not resolve '${obj[key]}' $ref`);
            }
          }
        }
      }
    } while (obj && hits > 0);
  };
  ts(obj);
};

/* Resolves a path in an object

     obj = {
       prompt: "hello",
       messages: [
         { role: "system", content: "you are a helpful assistant" },
         { role: "user", content: "tell me a joke" },
       ]
     }

     path = ["messages"]
     returns [
       { role: "system", content: "you are a helpful assistant" },
       { role: "user", content: "tell me a joke" },
     ]

     path = ["messages", 1, "role"]
     returns "system"

     path = ["prompt"]
     returns "hello"

     path = ["invalid", "path"]
     returns undefined

  */

export const resolvePayload = (path: Array<string | number>, obj: any): resolvedResponse => {
  let resolvedObject = path.reduce(function (prev, curr) {
    return prev ? prev[curr] : undefined;
  }, obj);

  return { metadata: getMetaData(resolvedObject), resolvedObject };
};

// JSON Pointer notation https://datatracker.ietf.org/doc/html/rfc6901
export const pathToString = (path: Array<string | number>) => {
  return path.length == 0 ? `/` : path.map((item) => `/${item}`).join("");
};

// https://json-schema.org/understanding-json-schema/reference/type
export const getMetaData = (value: any): metaData => {
  let size = 0;
  let types: any = new Set([]);
  let properties: any = [];
  if (value === null) {
    types.add("null");
  } else if (typeof value == "string") {
    types.add("string");
    size = value.length;
  } else if (typeof value == "number") {
    size = 1;
    types.add("number");
    if (Number.isInteger(value)) {
      types.add("integer");
    }
  } else if (typeof value == "boolean") {
    types.add("boolean");
    size = 1;
  } else if (Array.isArray(value)) {
    size = value.length;
    types.add("array");
    if (value.find((item) => typeof item !== "number" && typeof item !== "string") == undefined) {
      types.add("binary");
    }
  } else if (typeof value == "object") {
    types.add("object");
    size = Object.keys(value).length;
    properties = Object.keys(value);
  }
  return { types, size, properties };
};
