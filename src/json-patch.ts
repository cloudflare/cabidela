const setObjectProperty = (object: any, property: string, value: any) =>
  Object.defineProperty(object, property, { value, writable: true, enumerable: true, configurable: true });

type JsonPatchOperation = {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  from?: string;
  value?: any;
};

export const parseJsonPointer = (pointer: string): string[] => {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error(`Invalid JSON Pointer '${pointer}'`);
  if (/~(?:[^01]|$)/.test(pointer)) throw new Error(`Invalid JSON Pointer '${pointer}'`);
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
};

const arrayIndex = (token: string, length: number, allowEnd: boolean): number => {
  if (!/^(0|[1-9][0-9]*)$/.test(token)) throw new Error(`Invalid array index '${token}'`);
  const index = Number(token);
  if (index > length || (!allowEnd && index === length)) throw new Error(`Array index '${token}' is out of bounds`);
  return index;
};

const getJsonPointer = (document: any, pointer: string): any => {
  let value = document;
  for (const token of parseJsonPointer(pointer)) {
    if (Array.isArray(value)) {
      value = value[arrayIndex(token, value.length, false)];
    } else if (value !== null && typeof value === "object" && Object.hasOwn(value, token)) {
      value = value[token];
    } else {
      throw new Error(`JSON Pointer '${pointer}' does not exist`);
    }
  }
  return value;
};

const getJsonPointerParent = (document: any, pointer: string) => {
  const path = parseJsonPointer(pointer);
  if (path.length === 0) return { parent: undefined, token: undefined };
  const token = path.pop() as string;
  const parentPointer =
    path.length === 0 ? "" : `/${path.map((part) => part.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
  return { parent: getJsonPointer(document, parentPointer), token };
};

const addJsonPointer = (document: any, pointer: string, value: any): any => {
  const { parent, token } = getJsonPointerParent(document, pointer);
  if (token === undefined) return value;
  if (Array.isArray(parent)) {
    if (token === "-") {
      parent.push(value);
    } else {
      parent.splice(arrayIndex(token, parent.length, true), 0, value);
    }
  } else if (parent !== null && typeof parent === "object") {
    setObjectProperty(parent, token, value);
  } else {
    throw new Error(`JSON Pointer '${pointer}' parent is not a container`);
  }
  return document;
};

const removeJsonPointer = (document: any, pointer: string): any => {
  const { parent, token } = getJsonPointerParent(document, pointer);
  if (token === undefined) return undefined;
  if (Array.isArray(parent)) {
    parent.splice(arrayIndex(token, parent.length, false), 1);
  } else if (parent !== null && typeof parent === "object" && Object.hasOwn(parent, token)) {
    delete parent[token];
  } else {
    throw new Error(`JSON Pointer '${pointer}' does not exist`);
  }
  return document;
};

const replaceJsonPointer = (document: any, pointer: string, value: any): any => {
  const { parent, token } = getJsonPointerParent(document, pointer);
  if (token === undefined) return value;
  if (Array.isArray(parent)) {
    parent[arrayIndex(token, parent.length, false)] = value;
  } else if (parent !== null && typeof parent === "object" && Object.hasOwn(parent, token)) {
    setObjectProperty(parent, token, value);
  } else {
    throw new Error(`JSON Pointer '${pointer}' does not exist`);
  }
  return document;
};

const jsonEquals = (left: any, right: any): boolean => {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && jsonEquals(left[key], right[key]))
  );
};

export const applyJsonPatch = (source: any, operations: JsonPatchOperation[]): any => {
  if (!Array.isArray(operations)) throw new Error("$patch 'with' must be an array");
  let document = structuredClone(source);
  for (const operation of operations) {
    if (!operation || typeof operation.path !== "string") throw new Error("Invalid JSON patch operation");
    switch (operation.op) {
      case "add":
        if (!Object.hasOwn(operation, "value")) throw new Error("JSON patch add operation requires 'value'");
        document = addJsonPointer(document, operation.path, structuredClone(operation.value));
        break;
      case "remove":
        document = removeJsonPointer(document, operation.path);
        break;
      case "replace":
        if (!Object.hasOwn(operation, "value")) throw new Error("JSON patch replace operation requires 'value'");
        document = replaceJsonPointer(document, operation.path, structuredClone(operation.value));
        break;
      case "move": {
        if (typeof operation.from !== "string") throw new Error("JSON patch move operation requires 'from'");
        const value = getJsonPointer(document, operation.from);
        document = removeJsonPointer(document, operation.from);
        document = addJsonPointer(document, operation.path, value);
        break;
      }
      case "copy":
        if (typeof operation.from !== "string") throw new Error("JSON patch copy operation requires 'from'");
        document = addJsonPointer(document, operation.path, structuredClone(getJsonPointer(document, operation.from)));
        break;
      case "test":
        if (!Object.hasOwn(operation, "value")) throw new Error("JSON patch test operation requires 'value'");
        if (!jsonEquals(getJsonPointer(document, operation.path), operation.value)) {
          throw new Error(`JSON patch test failed at '${operation.path}'`);
        }
        break;
      default:
        throw new Error(`Unsupported JSON patch operation '${operation.op}'`);
    }
  }
  return document;
};
