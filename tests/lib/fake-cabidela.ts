import { Cabidela } from "../../src";
import Ajv from "ajv";
import * as Validators from "./static-validators.js";

export class FakeCabidela {
  public schema: any;
  public options: any;
  validator: any;
  ajv: any;

  constructor(schema: any, options?: any) {
    this.schema = schema;
    this.options = options || {};
    this.ajv;
    this.newInstance();
  }

  newInstance() {
    if (process.env.AJV || this.options.useAJV) {
      this.ajv = new Ajv({
        allErrors: true,
        removeAdditional: true,
        strict: false,
        useDefaults: this.options.applyDefaults ? true : false,
      });
      if (this.options.useMerge) {
        require("ajv-merge-patch")(this.ajv);
      }
      if (this.options.subSchemas) {
        this.options.subSchemas.forEach((subSchema: any) => {
          this.ajv.addSchema(subSchema);
        });
      }
      this.validator = this.ajv.compile(this.schema);
    } else if (process.env.AJVStatic || this.options.useAJVStatic) {
      this.validator = Validators[`#/definitions/${this.schema.$id}`];
      if (!this.validator) {
        throw new Error(`Validator for "#/definitions/${this.schema.$id}" not found`);
      }
    } else {
      this.validator = new Cabidela(this.schema, this.options);
    }
  }

  addSchema(schema: any) {
    if (process.env.AJV || this.options.useAJV) {
      throw new Error("addSchema is not supported this way with AJV, skip this test");
    } else {
      this.validator.addSchema(schema);
    }
  }

  getSchema() {
    return this.schema;
  }

  setSchema(schema: any) {
    this.schema = schema;
    this.newInstance();
  }

  setOptions(options: any) {
    this.options = options;
    this.newInstance();
  }

  validate(payload: any) {
    // do the test using Ajv
    if (process.env.AJV || this.options.useAJV || this.options.useAJVStatic || process.env.AJVStatic) {
      const valid = this.validator(payload);
      if (!valid) {
        const description = this.validator.errors
          .map((e: any) => {
            const instancePath = e.instancePath.split("/").join("");
            return instancePath === "" ? e.message : `'${instancePath}' ${e.message}`;
          })
          .join(", ");
        throw new Error(description);
      }
      return true;
    } else {
      // do the test using Cabidela
      return this.validator.validate(payload);
    }
  }
}
