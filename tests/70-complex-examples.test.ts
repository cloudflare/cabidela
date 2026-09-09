import { expect, test, describe, it } from "vitest";
import { FakeCabidela } from "./lib/fake-cabidela";
import { Cabidela } from "../src";
import { schemaBlocks } from "./lib/subschemas";
import fs from "fs";

describe("Same property names, different branches", () => {
  let schema = {
    type: "object",
    properties: {
      number: { type: "number" },
      child: {
        type: "object",
        properties: {
          number: { type: "number" },
        },
      },
    },
    required: ["number"],
  };

  let validator = new FakeCabidela(schema);

  it("first level number not met", () => {
    expect(() => validator.validate({ number2: 1600, child: { number: 1600 } })).toThrowError();
  });
});

describe("Ai, Text Generation", () => {
  let schema = {
    type: "object",
    oneOf: [
      {
        title: "Prompt",
        properties: {
          prompt: {
            type: "string",
            minLength: 1,
            maxLength: 131072,
            description: "The input text prompt for the model to generate a response.",
          },
          raw: {
            type: "boolean",
            default: false,
            description:
              "If true, a chat template is not applied and you must adhere to the specific model's expected formatting.",
          },
          stream: {
            type: "boolean",
            default: false,
            description: "If true, the response will be streamed back incrementally using SSE, Server Sent Events.",
          },
          max_tokens: {
            type: "integer",
            default: 256,
            description: "The maximum number of tokens to generate in the response.",
          },
          temperature: {
            type: "number",
            default: 0.6,
            minimum: 0,
            maximum: 5,
            description: "Controls the randomness of the output; higher values produce more random results.",
          },
          top_p: {
            type: "number",
            minimum: 0,
            maximum: 2,
            description:
              "Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.",
          },
          top_k: {
            type: "integer",
            minimum: 1,
            maximum: 50,
            description:
              "Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.",
          },
          seed: {
            type: "integer",
            minimum: 1,
            maximum: 9999999999,
            description: "Random seed for reproducibility of the generation.",
          },
          repetition_penalty: {
            type: "number",
            minimum: 0,
            maximum: 2,
            description: "Penalty for repeated tokens; higher values discourage repetition.",
          },
          frequency_penalty: {
            type: "number",
            minimum: 0,
            maximum: 2,
            description: "Decreases the likelihood of the model repeating the same lines verbatim.",
          },
          presence_penalty: {
            type: "number",
            minimum: 0,
            maximum: 2,
            description: "Increases the likelihood of the model introducing new topics.",
          },
          lora: {
            type: "string",
            description: "Name of the LoRA (Low-Rank Adaptation) model to fine-tune the base model.",
          },
        },
        required: ["prompt"],
      },
      {
        title: "Messages",
        properties: {
          messages: {
            type: "array",
            description: "An array of message objects representing the conversation history.",
            items: {
              type: "object",
              properties: {
                role: {
                  type: "string",
                  description: "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').",
                },
                content: {
                  type: "string",
                  maxLength: 131072,
                  description: "The content of the message as a string.",
                },
              },
              required: ["role", "content"],
            },
          },
          functions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                },
                code: {
                  type: "string",
                },
              },
              required: ["name", "code"],
            },
          },
          tools: {
            type: "array",
            description: "A list of tools available for the assistant to use.",
            items: {
              type: "object",
              oneOf: [
                {
                  properties: {
                    name: {
                      type: "string",
                      description: "The name of the tool. More descriptive the better.",
                    },
                    description: {
                      type: "string",
                      description: "A brief description of what the tool does.",
                    },
                    parameters: {
                      type: "object",
                      description: "Schema defining the parameters accepted by the tool.",
                      properties: {
                        type: {
                          type: "string",
                          description: "The type of the parameters object (usually 'object').",
                        },
                        required: {
                          type: "array",
                          description: "List of required parameter names.",
                          items: {
                            type: "string",
                          },
                        },
                        properties: {
                          type: "object",
                          description: "Definitions of each parameter.",
                          additionalProperties: {
                            type: "object",
                            properties: {
                              type: {
                                type: "string",
                                description: "The data type of the parameter.",
                              },
                              description: {
                                type: "string",
                                description: "A description of the expected parameter.",
                              },
                            },
                            required: ["type", "description"],
                          },
                        },
                      },
                      required: ["type", "properties"],
                    },
                  },
                  required: ["name", "description", "parameters"],
                },
                {
                  properties: {
                    type: {
                      type: "string",
                      description: "Specifies the type of tool (e.g., 'function').",
                    },
                    function: {
                      type: "object",
                      description: "Details of the function tool.",
                      properties: {
                        name: {
                          type: "string",
                          description: "The name of the function.",
                        },
                        description: {
                          type: "string",
                          description: "A brief description of what the function does.",
                        },
                        parameters: {
                          type: "object",
                          description: "Schema defining the parameters accepted by the function.",
                          properties: {
                            type: {
                              type: "string",
                              description: "The type of the parameters object (usually 'object').",
                            },
                            required: {
                              type: "array",
                              description: "List of required parameter names.",
                              items: {
                                type: "string",
                              },
                            },
                            properties: {
                              type: "object",
                              description: "Definitions of each parameter.",
                              additionalProperties: {
                                type: "object",
                                properties: {
                                  type: {
                                    type: "string",
                                    description: "The data type of the parameter.",
                                  },
                                  description: {
                                    type: "string",
                                    description: "A description of the expected parameter.",
                                  },
                                },
                                required: ["type", "description"],
                              },
                            },
                          },
                          required: ["type", "properties"],
                        },
                      },
                      required: ["name", "description", "parameters"],
                    },
                  },
                  required: ["type", "function"],
                },
              ],
            },
          },
          stream: {
            type: "boolean",
            default: false,
            description: "If true, the response will be streamed back incrementally.",
          },
          max_tokens: {
            type: "integer",
            default: 256,
            description: "The maximum number of tokens to generate in the response.",
          },
          temperature: {
            type: "number",
            default: 0.6,
            minimum: 0,
            maximum: 5,
            description: "Controls the randomness of the output; higher values produce more random results.",
          },
          top_p: {
            type: "number",
            minimum: 0,
            maximum: 2,
            description:
              "Controls the creativity of the AI's responses by adjusting how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.",
          },
          top_k: {
            type: "integer",
            minimum: 1,
            maximum: 50,
            description:
              "Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.",
          },
          seed: {
            type: "integer",
            minimum: 1,
            maximum: 9999999999,
            description: "Random seed for reproducibility of the generation.",
          },
          repetition_penalty: {
            type: "number",
            minimum: 0,
            maximum: 2,
            description: "Penalty for repeated tokens; higher values discourage repetition.",
          },
          frequency_penalty: {
            type: "number",
            minimum: 0,
            maximum: 2,
            description: "Decreases the likelihood of the model repeating the same lines verbatim.",
          },
          presence_penalty: {
            type: "number",
            minimum: 0,
            maximum: 2,
            description: "Increases the likelihood of the model introducing new topics.",
          },
        },
        required: ["messages"],
      },
    ],
  };

  let validator = new FakeCabidela(schema);

  it("simple prompt", () => {
    expect(() => validator.validate({ prompt: "tell me a joke" })).not.toThrowError();
  });
  it("messages", () => {
    expect(() =>
      validator.validate({
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
          { role: "user", content: "How are you?" },
          { role: "assistant", content: "I'm doing well, thank you." },
        ],
      }),
    ).not.toThrowError();
  });
  it("tools", () => {
    expect(() =>
      validator.validate({
        messages: [{ role: "user", content: "Who is Cloudflare on github?" }],
        tools: [
          {
            name: "getGithubUser",
            description: "Provides publicly available information about someone with a GitHub account.",
            parameters: {
              type: "object",
              properties: {
                username: {
                  type: "string",
                  description: "The handle for the GitHub user account.",
                },
              },
              required: ["username"],
            },
          },
        ],
      }),
    ).not.toThrowError();
  });
});

describe("Ai, oneOf prompt,image required", () => {
  let schema = {
    type: "object",
    oneOf: [
      {
        title: "Prompt",
        properties: {
          prompt: {
            type: "string",
            minLength: 1,
            maxLength: 131072,
            description: "The input text prompt for the model to generate a response.",
          },
          image: {
            oneOf: [
              {
                type: "array",
                description:
                  "An array of integers that represent the image data constrained to 8-bit unsigned integer values",
                items: {
                  type: "number",
                  description: "A value between 0 and 255",
                },
              },
              {
                type: "string",
                format: "binary",
                description: "Binary string representing the image contents.",
              },
            ],
          },
          raw: {
            type: "boolean",
            default: false,
            description:
              "If true, a chat template is not applied and you must adhere to the specific model's expected formatting.",
          },
        },
        required: ["prompt", "image"],
      },
    ],
  };
  let validator = new FakeCabidela(schema);

  it("prompt, no image", () => {
    expect(() => validator.validate({ prompt: "tell me a joke" })).toThrowError();
  });

  it("prompt and image", () => {
    expect(() => validator.validate({ prompt: "tell me a joke", image: [1, 2, 3] })).not.toThrowError();
  });
});

describe("Ai, Combined Text Generation", () => {
  it("multiple $merges and $refs", () => {
    let schema = {
      $id: "http://ai.cloudflare.com/schemas/textGenerationInput",
      type: "object",
      oneOf: [
        {
          title: "Prompt",
          properties: {
            $merge: {
              source: {
                prompt: { $ref: "textGenerationPrompts#/prompt" },
                lora: { $ref: "textGenerationFinetune#/lora" },
                response_format: { $ref: "jsonMode#/response_format" },
              },
              with: {
                $ref: "textGenerationOptions#/common",
              },
            },
          },
          required: ["prompt"],
        },
        {
          title: "Messages",
          properties: {
            $merge: {
              source: {
                messages: { $ref: "textGenerationPrompts#/messages" },
                functions: { $ref: "textGenerationTools#/functions" },
                tools: { $ref: "textGenerationTools#/tools" },
                response_format: { $ref: "jsonMode#/response_format" },
              },
              with: {
                $ref: "textGenerationOptions#/common",
              },
            },
          },
          required: ["messages"],
        },
      ],
    };

    // This asserts Cabidela's materialized schema; AJV does not rewrite its input.
    const cabidela = new Cabidela(schema, { subSchemas: schemaBlocks, useMerge: true, applyDefaults: true });
    schema = cabidela.getSchema();
    fs.writeFileSync("/tmp/schema.json", JSON.stringify(schema, null, 2));
    expect(schema).toStrictEqual({
      $id: "http://ai.cloudflare.com/schemas/textGenerationInput",
      type: "object",
      oneOf: [
        {
          title: "Prompt",
          properties: {
            prompt: {
              type: "string",
              minLength: 1,
              description: "The input text prompt for the model to generate a response.",
            },
            lora: {
              type: "string",
              description: "Name of the LoRA (Low-Rank Adaptation) model to fine-tune the base model.",
            },
            response_format: {
              title: "JSON Mode",
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["json_object", "json_schema"],
                },
                json_schema: {},
              },
            },
            raw: {
              type: "boolean",
              default: false,
              description:
                "If true, a chat template is not applied and you must adhere to the specific model's expected formatting.",
            },
            stream: {
              type: "boolean",
              default: false,
              description: "If true, the response will be streamed back incrementally using SSE, Server Sent Events.",
            },
            max_tokens: {
              type: "integer",
              default: 256,
              description: "The maximum number of tokens to generate in the response.",
            },
            temperature: {
              type: "number",
              default: 0.6,
              minimum: 0,
              maximum: 5,
              description: "Controls the randomness of the output; higher values produce more random results.",
            },
            top_p: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description:
                "Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.",
            },
            top_k: {
              type: "integer",
              minimum: 1,
              maximum: 50,
              description:
                "Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.",
            },
            seed: {
              type: "integer",
              minimum: 1,
              maximum: 9999999999,
              description: "Random seed for reproducibility of the generation.",
            },
            repetition_penalty: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description: "Penalty for repeated tokens; higher values discourage repetition.",
            },
            frequency_penalty: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description: "Decreases the likelihood of the model repeating the same lines verbatim.",
            },
            presence_penalty: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description: "Increases the likelihood of the model introducing new topics.",
            },
          },
          required: ["prompt"],
        },
        {
          title: "Messages",
          properties: {
            messages: {
              type: "array",
              description: "An array of message objects representing the conversation history.",
              items: {
                type: "object",
                properties: {
                  role: {
                    type: "string",
                    description: "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').",
                  },
                  content: {
                    type: "string",
                    description: "The content of the message as a string.",
                  },
                },
                required: ["role", "content"],
              },
            },
            functions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                  },
                  code: {
                    type: "string",
                  },
                },
                required: ["name", "code"],
              },
            },
            tools: {
              type: "array",
              description: "A list of tools available for the assistant to use.",
              items: {
                type: "object",
                oneOf: [
                  {
                    properties: {
                      name: {
                        type: "string",
                        description: "The name of the tool. More descriptive the better.",
                      },
                      description: {
                        type: "string",
                        description: "A brief description of what the tool does.",
                      },
                      parameters: {
                        type: "object",
                        description: "Schema defining the parameters accepted by the tool.",
                        properties: {
                          type: {
                            type: "string",
                            description: "The type of the parameters object (usually 'object').",
                          },
                          required: {
                            type: "array",
                            description: "List of required parameter names.",
                            items: {
                              type: "string",
                            },
                          },
                          properties: {
                            type: "object",
                            description: "Definitions of each parameter.",
                            additionalProperties: {
                              type: "object",
                              properties: {
                                type: {
                                  type: "string",
                                  description: "The data type of the parameter.",
                                },
                                description: {
                                  type: "string",
                                  description: "A description of the expected parameter.",
                                },
                              },
                              required: ["type", "description"],
                            },
                          },
                        },
                        required: ["type", "properties"],
                      },
                    },
                    required: ["name", "description", "parameters"],
                  },
                  {
                    properties: {
                      type: {
                        type: "string",
                        description: "Specifies the type of tool (e.g., 'function').",
                      },
                      function: {
                        type: "object",
                        description: "Details of the function tool.",
                        properties: {
                          name: {
                            type: "string",
                            description: "The name of the function.",
                          },
                          description: {
                            type: "string",
                            description: "A brief description of what the function does.",
                          },
                          parameters: {
                            type: "object",
                            description: "Schema defining the parameters accepted by the function.",
                            properties: {
                              type: {
                                type: "string",
                                description: "The type of the parameters object (usually 'object').",
                              },
                              required: {
                                type: "array",
                                description: "List of required parameter names.",
                                items: {
                                  type: "string",
                                },
                              },
                              properties: {
                                type: "object",
                                description: "Definitions of each parameter.",
                                additionalProperties: {
                                  type: "object",
                                  properties: {
                                    type: {
                                      type: "string",
                                      description: "The data type of the parameter.",
                                    },
                                    description: {
                                      type: "string",
                                      description: "A description of the expected parameter.",
                                    },
                                  },
                                  required: ["type", "description"],
                                },
                              },
                            },
                            required: ["type", "properties"],
                          },
                        },
                        required: ["name", "description", "parameters"],
                      },
                    },
                    required: ["type", "function"],
                  },
                ],
              },
            },
            response_format: {
              title: "JSON Mode",
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["json_object", "json_schema"],
                },
                json_schema: {},
              },
            },
            raw: {
              type: "boolean",
              default: false,
              description:
                "If true, a chat template is not applied and you must adhere to the specific model's expected formatting.",
            },
            stream: {
              type: "boolean",
              default: false,
              description: "If true, the response will be streamed back incrementally using SSE, Server Sent Events.",
            },
            max_tokens: {
              type: "integer",
              default: 256,
              description: "The maximum number of tokens to generate in the response.",
            },
            temperature: {
              type: "number",
              default: 0.6,
              minimum: 0,
              maximum: 5,
              description: "Controls the randomness of the output; higher values produce more random results.",
            },
            top_p: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description:
                "Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.",
            },
            top_k: {
              type: "integer",
              minimum: 1,
              maximum: 50,
              description:
                "Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.",
            },
            seed: {
              type: "integer",
              minimum: 1,
              maximum: 9999999999,
              description: "Random seed for reproducibility of the generation.",
            },
            repetition_penalty: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description: "Penalty for repeated tokens; higher values discourage repetition.",
            },
            frequency_penalty: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description: "Decreases the likelihood of the model repeating the same lines verbatim.",
            },
            presence_penalty: {
              type: "number",
              minimum: 0,
              maximum: 2,
              description: "Increases the likelihood of the model introducing new topics.",
            },
          },
          required: ["messages"],
        },
      ],
    });
  });
});
