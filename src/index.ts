import { resolvePayload, pathToString, traverseSchema } from "./helpers";

export type CabidelaOptions = {
  applyDefaults?: boolean;
  useMerge?: boolean;
  usePatch?: boolean;
  errorMessages?: boolean;
  fullErrors?: boolean;
  subSchemas?: Array<any>;
};

export type SchemaNavigation = {
  path: Array<string>;
  schema: any;
  payload: any;
  evaluatedProperties: Set<string>;
  carryProperties?: boolean;
  deferredApplyDefaults?: boolean;
  absorvErrors?: boolean;
  errors: Set<string>;
  defaultsCallbacks: Array<any>;
};

export class Cabidela {
  private schema: any;
  private options: CabidelaOptions;
  private definitions: any = {};

  constructor(schema: any, options?: CabidelaOptions) {
    this.schema = schema;
    this.options = {
      fullErrors: true,
      subSchemas: [],
      useMerge: false,
      usePatch: false,
      applyDefaults: false,
      errorMessages: false,
      ...(options || {}),
    };
    if (this.schema.hasOwnProperty("$defs")) {
      this.definitions["$defs"] = this.schema["$defs"];
      delete this.schema["$defs"];
    }
    if ((this.options.subSchemas as []).length > 0) {
      for (const subSchema of this.options.subSchemas as []) {
        this.addSchema(subSchema, false);
      }
    }
    if (this.options.useMerge || this.options.usePatch || (this.options.subSchemas as []).length > 0) {
      traverseSchema(this.options, this.definitions, this.schema);
    }
  }

  setSchema(schema: any) {
    this.schema = schema;
  }

  addSchema(subSchema: any, combine: boolean = true) {
    if (subSchema.hasOwnProperty("$id")) {
      const url = URL.parse(subSchema["$id"]);
      if (url) {
        this.definitions[url.pathname.split("/").slice(-1)[0]] = subSchema;
      } else {
        throw new Error(
          "subSchemas need a valid retrieval URI $id https://json-schema.org/understanding-json-schema/structuring#retrieval-uri",
        );
      }
    } else {
      throw new Error("subSchemas need $id https://json-schema.org/understanding-json-schema/structuring#id");
    }
    if (combine == true) traverseSchema(this.options, this.definitions, this.schema);
  }

  getSchema() {
    return this.schema;
  }

  setOptions(options: CabidelaOptions) {
    this.options = { ...this.options, ...options };
  }

  throw(message: string, needle: SchemaNavigation) {
    const error = `${message}${this.options.fullErrors && needle.absorvErrors !== true && needle.errors.size > 0 ? `: ${Array.from(needle.errors).join(", ")}` : ``}`;
    throw new Error(this.options.errorMessages ? (needle.schema.errorMessage ?? error) : error);
  }

  parseAdditionalProperties(
    needle: SchemaNavigation,
    contextAdditionalProperties: any,
    contextEvaluatedProperties: Set<string>,
  ): number {
    let matchCount = 0;
    const { metadata, resolvedObject } = resolvePayload(needle.path, needle.payload);

    const unevaluatedProperties = new Set(
      metadata.properties.map((r: string) => pathToString([...needle.path, r])),
    ).difference(contextEvaluatedProperties);

    // Setting the additionalProperties schema to false means no additional properties will be allowed.
    if (contextAdditionalProperties === false) {
      if (unevaluatedProperties.size > 0) {
        this.throw(
          `Additional or unevaluated properties '${Array.from(unevaluatedProperties).join(", ")}' at '${pathToString(needle.path)}' not allowed`,
          {
            ...needle,
            schema: contextAdditionalProperties,
            payload: resolvedObject,
          },
        );
      }
    } else {
      for (let property of unevaluatedProperties) {
        if (
          this.parseSubSchema({
            path: [property.split("/").slice(-1)[0]],
            schema: contextAdditionalProperties,
            payload: resolvedObject,
            evaluatedProperties: new Set(),
            errors: new Set(),
            defaultsCallbacks: [],
          })
        ) {
          matchCount++;
          needle.evaluatedProperties.add(pathToString([property]));
        }
      }
    }
    return matchCount;
  }

  // Iterates through the properties of an "object" schema
  parseObject(needle: SchemaNavigation): boolean {
    if (needle.schema.hasOwnProperty("minProperties")) {
      if (Object.keys(needle.payload).length < needle.schema.minProperties) {
        this.throw(
          `minProperties at '${pathToString(needle.path)}' is ${needle.schema.minProperties}, got ${Object.keys(needle.payload).length}`,
          needle,
        );
      }
    }

    if (needle.schema.hasOwnProperty("maxProperties")) {
      if (Object.keys(needle.payload).length > needle.schema.maxProperties) {
        this.throw(
          `maxProperties at '${pathToString(needle.path)}' is ${needle.schema.maxProperties}, got ${Object.keys(needle.payload).length}`,
          needle,
        );
      }
    }

    const localEvaluatedProperties = new Set([] as string[]);
    let matchCount: number = 0;

    if (needle.schema.hasOwnProperty("properties")) {
      for (let property in needle.schema.properties) {
        const matches = this.parseSubSchema({
          ...needle,
          path: [...needle.path, property],
          schema: needle.schema.properties[property],
        });
        if (matches > 0) {
          localEvaluatedProperties.add(pathToString([...needle.path, property]));
          matchCount++;
        }
      }
    }

    // additionalProperties only recognizes properties declared in the same subschema as itself.
    if (needle.schema.hasOwnProperty("additionalProperties")) {
      matchCount += this.parseAdditionalProperties(
        needle,
        needle.schema.additionalProperties,
        localEvaluatedProperties,
      );
    }

    // unevaluatedProperties keyword is similar to additionalProperties except that it can recognize properties declared in subschemas.
    if (needle.schema.hasOwnProperty("unevaluatedProperties")) {
      needle.evaluatedProperties = new Set([...needle.evaluatedProperties, ...localEvaluatedProperties]);
      matchCount += this.parseAdditionalProperties(
        needle,
        needle.schema.unevaluatedProperties,
        needle.evaluatedProperties,
      );
    }

    // this has to be last
    if (needle.schema.hasOwnProperty("required")) {
      if (
        new Set(needle.schema.required.map((r: string) => pathToString([...needle.path, r]))).difference(
          needle.evaluatedProperties.union(localEvaluatedProperties),
        ).size > 0
      ) {
        this.throw(`required properties at '${pathToString(needle.path)}' are '${needle.schema.required}'`, needle);
      }
    }
    return matchCount ? true : false;
  }

  parseList(list: any, needle: SchemaNavigation, breakCondition?: Function) {
    let rounds = 0;
    const defaultsCallbacks: any = [];

    for (let option in list) {
      try {
        const matches = this.parseSubSchema({
          ...needle,
          schema: { type: needle.schema.type, ...list[option] },
          carryProperties: false,
          absorvErrors: true,
          deferredApplyDefaults: true,
        });
        rounds++;
        if (breakCondition && breakCondition(rounds)) break;
        defaultsCallbacks.push(...needle.defaultsCallbacks);
        needle.defaultsCallbacks = [];
      } catch (e: any) {
        needle.errors.add(e.message as string);
        needle.defaultsCallbacks = [];
      }
    }
    for (const callback of defaultsCallbacks) callback();
    needle.defaultsCallbacks = [];
    return rounds;
  }

  // Parses a JSON Schema sub-schema object - reentrant
  parseSubSchema(needle: SchemaNavigation): number {
    if (needle.schema == undefined) {
      this.throw(`No schema for path '${pathToString(needle.path)}'`, needle);
    }

    // https://json-schema.org/understanding-json-schema/reference/combining#not
    if (needle.schema.hasOwnProperty("not")) {
      let pass = false;
      try {
        this.parseSubSchema({
          ...needle,
          schema: needle.schema.not,
        });
      } catch (e: any) {
        pass = true;
      }
      if (pass == false) {
        this.throw(`not at '${pathToString(needle.path)}' not met`, needle);
      }
    }

    // To validate against oneOf, the given data must be valid against exactly one of the given subschemas.
    if (needle.schema.hasOwnProperty("oneOf")) {
      const rounds = this.parseList(needle.schema.oneOf, needle, (r: number) => r !== 1);
      if (rounds !== 1) {
        this.throw(`oneOf at '${pathToString(needle.path)}' not met, ${rounds} matches found`, needle);
        return 0;
      }
      return 1;
    }

    // To validate against anyOf, the given data must be valid against any (one or more) of the given subschemas.
    if (needle.schema.hasOwnProperty("anyOf")) {
      if (this.parseList(needle.schema.anyOf, needle, (r: number) => r !== 0) === 0) {
        if (needle.path.length == 0) {
          this.throw(`anyOf at '${pathToString(needle.path)}' not met`, needle);
        }
        return 0;
      }
      return 1;
    }

    // To validate against allOf, the given data must be valid against all of the given subschemas.
    if (needle.schema.hasOwnProperty("allOf")) {
      const conditions = needle.schema.allOf.reduce((r: any, c: any) => Object.assign(r, c), {});
      try {
        this.parseSubSchema({
          ...needle,
          schema: { type: needle.schema.type, ...conditions },
          carryProperties: true,
        });
      } catch (e: any) {
        if (needle.path.length == 0) {
          throw e;
        }
        needle.errors.add(e.message as string);
        return 0;
      }
    }

    const { metadata, resolvedObject } = resolvePayload(needle.path, needle.payload);

    // array, but object is not binary
    if (needle.schema.type === "array" && !metadata.types.has("binary") && !metadata.types.has("string")) {
      let matched = 0;
      for (let item in resolvedObject) {
        matched += this.parseSubSchema({
          ...needle,
          path: [...needle.path, item],
          schema: needle.schema.items,
        });
      }
      return matched;
    } else if (needle.schema.type === "object" || needle.schema.properties) {
      return this.parseObject(needle) ? 1 : 0;
    } else if (resolvedObject !== undefined) {
      // This has to be before type checking
      if (needle.schema.hasOwnProperty("const")) {
        if (resolvedObject !== needle.schema.const) {
          this.throw(
            `const ${resolvedObject} doesn't match ${needle.schema.const} at '${pathToString(needle.path)}'`,
            needle,
          );
        } else {
          // You can use const even without a type, to accept values of different types.
          // If that's the case, then skip type checking below
          if (needle.schema.type == undefined) return 1;
        }
      }
      // This has to be before type checking
      if (needle.schema.hasOwnProperty("enum")) {
        if (Array.isArray(needle.schema.enum)) {
          if (!needle.schema.enum.includes(resolvedObject)) {
            this.throw(
              `enum ${resolvedObject} not in ${needle.schema.enum.join(",")} at '${pathToString(needle.path)}'`,
              needle,
            );
          } else {
            // You can use enum even without a type, to accept values of different types.
            // If that's the case, then skip type checking below
            if (needle.schema.type == undefined) return 1;
          }
        } else {
          this.throw(`enum should be an array at '${pathToString(needle.path)}'`, needle);
        }
      }
      // This has to be after handling enum
      if (needle.schema.hasOwnProperty("type") && !metadata.types.has(needle.schema.type)) {
        this.throw(
          `Type mismatch of '${pathToString(needle.path)}', '${needle.schema.type}' not in ${Array.from(metadata.types)
            .map((e) => `'${e}'`)
            .join(",")}`,
          needle,
        );
      }
      /* If property === true, then it's declared validated no matter what the value is */
      if (needle.schema !== true) {
        /* Otherwise check schema type */
        switch (needle.schema.type) {
          case "string":
            if (needle.schema.hasOwnProperty("maxLength") && metadata.size > needle.schema.maxLength) {
              this.throw(`Length of '${pathToString(needle.path)}' must be <= ${needle.schema.maxLength}`, needle);
            }
            if (needle.schema.hasOwnProperty("minLength") && metadata.size < needle.schema.minLength) {
              this.throw(
                `Length of '${pathToString(needle.path)}' must be >= ${needle.schema.minLength} not met`,
                needle,
              );
            }
            break;
          case "number":
          case "integer":
            if (needle.schema.hasOwnProperty("minimum") && resolvedObject < needle.schema.minimum) {
              this.throw(`'${pathToString(needle.path)}' must be >= ${needle.schema.minimum}`, needle);
            }
            if (needle.schema.hasOwnProperty("exclusiveMinimum") && resolvedObject <= needle.schema.exclusiveMinimum) {
              this.throw(`'${pathToString(needle.path)}' must be > ${needle.schema.exclusiveMinimum}`, needle);
            }
            if (needle.schema.hasOwnProperty("maximum") && resolvedObject > needle.schema.maximum) {
              this.throw(`'${pathToString(needle.path)}' must be <= ${needle.schema.maximum}`, needle);
            }
            if (needle.schema.hasOwnProperty("exclusiveMaximum") && resolvedObject >= needle.schema.exclusiveMaximum) {
              this.throw(`'${pathToString(needle.path)}' must be < ${needle.schema.exclusiveMaximum}`, needle);
            }
            if (needle.schema.hasOwnProperty("multipleOf") && resolvedObject % needle.schema.multipleOf !== 0) {
              this.throw(`'${pathToString(needle.path)}' must be multiple of ${needle.schema.multipleOf}`, needle);
            }
            break;
        }
      }
      if (needle.schema.hasOwnProperty("pattern")) {
        let passes = false;
        try {
          if (new RegExp(needle.schema.pattern).test(resolvedObject)) passes = true;
        } catch (e) {}
        if (!passes) this.throw(`'${pathToString(needle.path)}' failed test ${needle.schema.pattern} patttern`, needle);
      }

      if (needle.carryProperties) {
        needle.evaluatedProperties.add(pathToString(needle.path));
      }
      return 1;
    }
    // Apply defaults
    if (this.options.applyDefaults === true && needle.schema.hasOwnProperty("default")) {
      const applyDefaults = () => {
        needle.path.reduce(function (prev, curr, index) {
          // create objects as needed along the path, if they don't exist, so we can apply defaults at the end
          if (prev[curr] === undefined) {
            prev[curr] = {};
          }
          if (index == needle.path.length - 1) {
            prev[curr] = needle.schema.default;
            // defaults add to evaluatedProperties and can meet "required" constraints
            needle.evaluatedProperties.add(pathToString(needle.path));
          }
          return prev ? prev[curr] : undefined;
        }, needle.payload);
      };
      if (needle.deferredApplyDefaults === true) {
        needle.defaultsCallbacks.push(applyDefaults);
      } else {
        applyDefaults();
      }
    }
    return 0;
  }

  validate(payload: any) {
    const needle: SchemaNavigation = {
      errors: new Set(),
      defaultsCallbacks: [],
      evaluatedProperties: new Set(),
      path: [],
      schema: this.schema,
      payload,
    };
    this.parseSubSchema(needle);
    return true;
  }
}
