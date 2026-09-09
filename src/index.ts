import { resolvePayload, pathToString } from "./helpers";
import { resolveSchema, replaceObject } from "./schema";

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
  private localDefinitions: any;
  private addedSchemas: Array<any> = [];

  constructor(schema: any, options?: CabidelaOptions) {
    const nextOptions = {
      fullErrors: true,
      subSchemas: [],
      useMerge: false,
      usePatch: false,
      applyDefaults: false,
      errorMessages: false,
      ...(options || {}),
    };
    const prepared = this.prepareNewSchema(schema, nextOptions, []);
    this.schema = replaceObject(schema, prepared.schema);
    this.options = nextOptions;
    this.localDefinitions = prepared.localDefinitions;
  }

  setSchema(schema: any) {
    const prepared = this.prepareNewSchema(schema, this.options, this.addedSchemas);
    this.schema = replaceObject(schema, prepared.schema);
    this.localDefinitions = prepared.localDefinitions;
  }

  addSchema(subSchema: any, combine: boolean = true) {
    const addedSchemas = [...this.addedSchemas, structuredClone(subSchema)];
    const prepared = this.prepareSchema(this.schema, this.options, this.localDefinitions, addedSchemas, combine);
    replaceObject(this.schema, prepared.schema);
    this.addedSchemas = addedSchemas;
  }

  private registerSchema(definitions: any, subSchema: any) {
    if (subSchema && Object.hasOwn(subSchema, "$id")) {
      const url = URL.parse(subSchema["$id"]);
      if (url) {
        definitions[url.pathname.split("/").slice(-1)[0]] = structuredClone(subSchema);
      } else {
        throw new Error(
          "subSchemas need a valid retrieval URI $id https://json-schema.org/understanding-json-schema/structuring#retrieval-uri",
        );
      }
    } else {
      throw new Error("subSchemas need $id https://json-schema.org/understanding-json-schema/structuring#id");
    }
  }

  private prepareNewSchema(schema: any, options: CabidelaOptions, addedSchemas: Array<any>) {
    const localDefinitions = schema["$defs"];
    const candidate = Object.hasOwn(schema, "$defs") ? { ...schema } : schema;
    if (candidate !== schema) delete candidate["$defs"];
    return this.prepareSchema(candidate, options, localDefinitions, addedSchemas, true);
  }

  private prepareSchema(
    schema: any,
    options: CabidelaOptions,
    localDefinitions: any,
    addedSchemas: Array<any>,
    combine: boolean,
  ) {
    let candidate = schema;
    const definitions: any = Object.create(null);
    if (localDefinitions !== undefined) definitions["$defs"] = structuredClone(localDefinitions);
    for (const subSchema of options.subSchemas as []) this.registerSchema(definitions, subSchema);
    for (const subSchema of addedSchemas) this.registerSchema(definitions, subSchema);
    if (combine && (options.useMerge || options.usePatch || Object.keys(definitions).length > 0)) {
      candidate = resolveSchema(options, definitions, candidate);
    }
    return { schema: candidate, localDefinitions };
  }

  getSchema() {
    return this.schema;
  }

  setOptions(options: CabidelaOptions) {
    const nextOptions = { ...this.options, ...options };
    const prepared = this.prepareSchema(this.schema, nextOptions, this.localDefinitions, this.addedSchemas, true);
    replaceObject(this.schema, prepared.schema);
    this.options = nextOptions;
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
    if (Object.hasOwn(needle.schema, "minProperties")) {
      if (Object.keys(needle.payload).length < needle.schema.minProperties) {
        this.throw(
          `minProperties at '${pathToString(needle.path)}' is ${needle.schema.minProperties}, got ${Object.keys(needle.payload).length}`,
          needle,
        );
      }
    }

    if (Object.hasOwn(needle.schema, "maxProperties")) {
      if (Object.keys(needle.payload).length > needle.schema.maxProperties) {
        this.throw(
          `maxProperties at '${pathToString(needle.path)}' is ${needle.schema.maxProperties}, got ${Object.keys(needle.payload).length}`,
          needle,
        );
      }
    }

    const localEvaluatedProperties = new Set([] as string[]);
    let matchCount: number = 0;

    if (Object.hasOwn(needle.schema, "properties")) {
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
    if (Object.hasOwn(needle.schema, "additionalProperties")) {
      matchCount += this.parseAdditionalProperties(
        needle,
        needle.schema.additionalProperties,
        localEvaluatedProperties,
      );
    }

    // unevaluatedProperties keyword is similar to additionalProperties except that it can recognize properties declared in subschemas.
    if (Object.hasOwn(needle.schema, "unevaluatedProperties")) {
      needle.evaluatedProperties = new Set([...needle.evaluatedProperties, ...localEvaluatedProperties]);
      matchCount += this.parseAdditionalProperties(
        needle,
        needle.schema.unevaluatedProperties,
        needle.evaluatedProperties,
      );
    }

    // this has to be last
    if (Object.hasOwn(needle.schema, "required")) {
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
        const branch = {
          ...needle,
          schema: { ...(needle.schema.type === undefined ? {} : { type: needle.schema.type }), ...list[option] },
          carryProperties: false,
          absorvErrors: true,
          deferredApplyDefaults: true,
          defaultsCallbacks: [],
        };
        this.parseSubSchema(branch);
        // Validation failures throw. Property/item counts are not branch counts:
        // an empty object or a multi-item array can each match one whole branch.
        rounds++;
        defaultsCallbacks.push(...branch.defaultsCallbacks);
        if (breakCondition && breakCondition(rounds)) break;
      } catch (e: any) {
        needle.errors.add(e.message as string);
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

    const { metadata, resolvedObject } = resolvePayload(needle.path, needle.payload);
    if (
      resolvedObject !== undefined &&
      Object.hasOwn(needle.schema, "type") &&
      !metadata.types.has(needle.schema.type)
    ) {
      this.throw(
        `Type mismatch of '${pathToString(needle.path)}', '${needle.schema.type}' not in ${Array.from(metadata.types)
          .map((e) => `'${e}'`)
          .join(",")}`,
        needle,
      );
    }

    // https://json-schema.org/understanding-json-schema/reference/combining#not
    if (resolvedObject !== undefined && Object.hasOwn(needle.schema, "not")) {
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
    if (resolvedObject !== undefined && Object.hasOwn(needle.schema, "oneOf")) {
      const rounds = this.parseList(needle.schema.oneOf, needle, (r: number) => r !== 1);
      if (rounds !== 1) {
        this.throw(`oneOf at '${pathToString(needle.path)}' not met, ${rounds} matches found`, needle);
      }
      return 1;
    }

    // To validate against anyOf, the given data must be valid against any (one or more) of the given subschemas.
    if (resolvedObject !== undefined && Object.hasOwn(needle.schema, "anyOf")) {
      if (this.parseList(needle.schema.anyOf, needle, (r: number) => r !== 0) === 0) {
        this.throw(`anyOf at '${pathToString(needle.path)}' not met`, needle);
      }
      return 1;
    }

    // To validate against allOf, the given data must be valid against all of the given subschemas.
    if (resolvedObject !== undefined && Object.hasOwn(needle.schema, "allOf")) {
      const conditions = needle.schema.allOf.reduce((r: any, c: any) => Object.assign(r, c), {});
      this.parseSubSchema({
        ...needle,
        schema: { ...(needle.schema.type === undefined ? {} : { type: needle.schema.type }), ...conditions },
        carryProperties: true,
      });
    }

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
      if (Object.hasOwn(needle.schema, "const")) {
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
      if (Object.hasOwn(needle.schema, "enum")) {
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
      /* If property === true, then it's declared validated no matter what the value is */
      if (needle.schema !== true) {
        /* Otherwise check schema type */
        switch (needle.schema.type) {
          case "string":
            if (Object.hasOwn(needle.schema, "maxLength") && metadata.size > needle.schema.maxLength) {
              this.throw(`Length of '${pathToString(needle.path)}' must be <= ${needle.schema.maxLength}`, needle);
            }
            if (Object.hasOwn(needle.schema, "minLength") && metadata.size < needle.schema.minLength) {
              this.throw(
                `Length of '${pathToString(needle.path)}' must be >= ${needle.schema.minLength} not met`,
                needle,
              );
            }
            break;
          case "number":
          case "integer":
            if (Object.hasOwn(needle.schema, "minimum") && resolvedObject < needle.schema.minimum) {
              this.throw(`'${pathToString(needle.path)}' must be >= ${needle.schema.minimum}`, needle);
            }
            if (Object.hasOwn(needle.schema, "exclusiveMinimum") && resolvedObject <= needle.schema.exclusiveMinimum) {
              this.throw(`'${pathToString(needle.path)}' must be > ${needle.schema.exclusiveMinimum}`, needle);
            }
            if (Object.hasOwn(needle.schema, "maximum") && resolvedObject > needle.schema.maximum) {
              this.throw(`'${pathToString(needle.path)}' must be <= ${needle.schema.maximum}`, needle);
            }
            if (Object.hasOwn(needle.schema, "exclusiveMaximum") && resolvedObject >= needle.schema.exclusiveMaximum) {
              this.throw(`'${pathToString(needle.path)}' must be < ${needle.schema.exclusiveMaximum}`, needle);
            }
            if (Object.hasOwn(needle.schema, "multipleOf") && resolvedObject % needle.schema.multipleOf !== 0) {
              this.throw(`'${pathToString(needle.path)}' must be multiple of ${needle.schema.multipleOf}`, needle);
            }
            break;
        }
      }
      if (Object.hasOwn(needle.schema, "pattern")) {
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
    if (this.options.applyDefaults === true && Object.hasOwn(needle.schema, "default")) {
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
