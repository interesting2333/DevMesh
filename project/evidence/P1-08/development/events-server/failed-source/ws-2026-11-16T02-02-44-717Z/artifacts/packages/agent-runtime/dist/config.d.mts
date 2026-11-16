import { z } from "zod";

//#region src/config.d.ts
declare const schema: z.ZodObject<{
  providers: z.ZodArray<z.ZodObject<{
    providerId: z.ZodString;
    endpoint: z.ZodURL;
    model: z.ZodString;
    credentialRef: z.ZodString;
    capabilities: z.ZodObject<{
      revision: z.ZodString;
      contextTokens: z.ZodNumber;
      maxOutputTokens: z.ZodNumber;
      toolCalls: z.ZodBoolean;
      structuredOutput: z.ZodEnum<{
        "json-object": "json-object";
        "text-json": "text-json";
      }>;
      tokenCounting: z.ZodLiteral<"utf8-conservative-v1">;
      reasoningMode: z.ZodLiteral<"disabled">;
      verification: z.ZodEnum<{
        DECLARED: "DECLARED";
        VERIFIED: "VERIFIED";
      }>;
      evidenceRef: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    connectTimeoutMs: z.ZodDefault<z.ZodNumber>;
    requestTimeoutMs: z.ZodDefault<z.ZodNumber>;
    maximumResponseBytes: z.ZodDefault<z.ZodNumber>;
  }, z.core.$strict>>;
  tokenLimit: z.ZodNumber;
  preparation: z.ZodOptional<z.ZodObject<{
    callerId: z.ZodString;
    productProviderId: z.ZodString;
    architectProviderId: z.ZodString;
    maxInputBytes: z.ZodNumber;
    maxOutputTokens: z.ZodNumber;
    bootstrapPaths: z.ZodDefault<z.ZodArray<z.ZodString>>;
  }, z.core.$strict>>;
}, z.core.$strict>;
type RuntimeConfig = z.output<typeof schema>;
declare function parseRuntimeConfig(value: unknown): RuntimeConfig;
//#endregion
export { RuntimeConfig, parseRuntimeConfig };
//# sourceMappingURL=config.d.mts.map