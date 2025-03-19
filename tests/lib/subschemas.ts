const schemaJsonMode = {
  $id: "http://ai.cloudflare.com/schemas/jsonMode",
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
};

const schemaTextGenerationTools = {
  $id: "http://ai.cloudflare.com/schemas/textGenerationTools",
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
};

const schemaTextGenerationPrompts = {
  $id: "http://ai.cloudflare.com/schemas/textGenerationPrompts",
  prompt: {
    type: "string",
    minLength: 1,
    description: "The input text prompt for the model to generate a response.",
  },
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
};

const schemaTextGenerationOptions = {
  $id: "http://ai.cloudflare.com/schemas/textGenerationOptions",
  common: {
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
};

const schemaTextGenerationFinetune = {
  $id: "http://ai.cloudflare.com/schemas/textGenerationFinetune",
  lora: {
    type: "string",
    description: "Name of the LoRA (Low-Rank Adaptation) model to fine-tune the base model.",
  },
};

export const schemaBlocks = [
  schemaTextGenerationPrompts,
  schemaTextGenerationOptions,
  schemaTextGenerationTools,
  schemaJsonMode,
  schemaTextGenerationFinetune,
];
