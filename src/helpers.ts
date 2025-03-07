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
  const $id = parts[0];
  const $path = parts[1].split("/").filter((part: string) => part !== "");
  return { $id, $path };
};

export const traverseSchema = (definitions: any, obj: any, cb: any = () => {}) => {
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== null && typeof obj[key] === "object") {
      traverseSchema(definitions, obj[key], (value: any) => {
        obj[key] = value;
      });
    } else {
      if (key === "$ref") {
        const { $id, $path } = parse$ref(obj[key]);
        const { resolvedObject } = resolvePayload($path, definitions[$id]);
        if (resolvedObject) {
          cb(resolvedObject);
        } else {
          throw new Error(`Could not resolve '${obj[key]}' $ref`);
        }
      }
    }
  });
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
