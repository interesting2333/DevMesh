import { Express } from "express";
import { z } from "zod";

//#region src/public-prototype.d.ts
declare const endpointSchema: z.ZodObject<{
  publicKey: z.ZodString;
  kind: z.ZodEnum<{
    agent: "agent";
    group: "group";
  }>;
  name: z.ZodString;
  applicationVersion: z.ZodString;
  publicCard: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
declare const configSchema: z.ZodUnion<readonly [z.ZodObject<{
  enabled: z.ZodLiteral<false>;
}, z.core.$strict>, z.ZodObject<{
  enabled: z.ZodLiteral<true>;
  mode: z.ZodLiteral<"loopback-protocol-prototype">;
  publicBaseUrl: z.ZodString;
  endpoints: z.ZodArray<z.ZodObject<{
    publicKey: z.ZodString;
    kind: z.ZodEnum<{
      agent: "agent";
      group: "group";
    }>;
    name: z.ZodString;
    applicationVersion: z.ZodString;
    publicCard: z.ZodDefault<z.ZodBoolean>;
  }, z.core.$strict>>;
  defaultEndpoint: z.ZodString;
  identities: z.ZodArray<z.ZodObject<{
    principalId: z.ZodString;
    credentialRef: z.ZodString;
    targets: z.ZodArray<z.ZodString>;
  }, z.core.$strict>>;
}, z.core.$strict>]>;
type PublicPrototypeConfig = z.output<typeof configSchema>;
type PrototypeEndpoint = z.output<typeof endpointSchema>;
type PrototypeCredentialResolver = (credentialRef: string) => Promise<string | undefined>;
/** Independent test configuration: never a published Exposure or a runtime grant. */
declare function parsePublicPrototypeConfig(value?: unknown): PublicPrototypeConfig;
/** Resolves all test credentials before mounting any route; failure leaves the app untouched. */
declare function mountPublicPrototype(app: Express, input: unknown, resolveCredential: PrototypeCredentialResolver): Promise<{
  mode: 'loopback-protocol-prototype';
  endpoints: number;
} | undefined>;
//#endregion
export { PrototypeCredentialResolver, PrototypeEndpoint, PublicPrototypeConfig, mountPublicPrototype, parsePublicPrototypeConfig };
//# sourceMappingURL=public-prototype.d.mts.map