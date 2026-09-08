import { expect, test, describe, it } from "vitest";
import { FakeCabidela } from "./lib/fake-cabidela";

describe("errorMessages simple", () => {
  let schema = {
    type: "object",
    properties: {
      prompt: {
        type: "string",
      },
    },
    required: ["prompt"],
    errorMessage: "prompt required",
  };
  let cabidela = new FakeCabidela(schema, { errorMessages: true });
  test.skipIf(process.env.AJV)("prompt required", () => {
    expect(() =>
      cabidela.validate({
        missing: "property",
      }),
    ).toThrowError(/prompt required/);
  });
  test.skipIf(process.env.AJV)("prompt required native", () => {
    cabidela.setOptions({ errorMessages: false });
    expect(() =>
      cabidela.validate({
        missing: "property",
      }),
    ).not.toThrowError(/prompt required/);
  });
});

describe("errorMessages oneOf", () => {
  let schema = {
    type: "object",
    oneOf: [
      {
        properties: {
          prompt: {
            type: "string",
            minLength: 1,
            maxLength: 131072,
            description: "The input text prompt for the model to generate a response.",
          },
          num_steps: {
            type: "number",
            minimum: 0,
            default: 1,
            maximum: 2,
            description: "Increases the likelihood of the model introducing new topics.",
          },
        },
        required: ["prompt"],
        errorMessage: "prompt required",
      },
      {
        properties: {
          messages: {
            type: "array",
            description: "An array of message objects representing the conversation history.",
            items: {
              type: "object",
              properties: {
                role: {
                  type: "string",
                  default: "heya",
                  description: "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').",
                },
                content: {
                  type: "string",
                  default: "man",
                  maxLength: 131072,
                  description: "The content of the message as a string.",
                },
              },
              required: ["role", "content"],
              errorMessage: "messages need both role and content",
            },
          },
        },
        required: ["messages"],
        errorMessage: "messages required",
      },
    ],
  };
  let cabidela = new FakeCabidela(schema, { errorMessages: true });
  test.skipIf(process.env.AJV)("either prompt or messages", () => {
    expect(() =>
      cabidela.validate({
        missing: "property",
      }),
    ).toThrowError(/oneOf at '\/' not met, 0 matches found: prompt required, messages required/);
  });
  test.skipIf(process.env.AJV)("messages need role and content", () => {
    expect(() =>
      cabidela.validate({
        messages: [{ role: "user" }],
      }),
    ).toThrowError(/oneOf at '\/' not met, 0 matches found: prompt required, messages need both role and content/);
  });
});
