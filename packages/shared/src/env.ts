import { z } from "zod";

const baseSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});

export const workerEnvSchema = baseSchema.extend({
  HEDERA_OPERATOR_ID: z.string().min(1),
  HEDERA_OPERATOR_KEY: z.string().min(1),
  HEDERA_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  HCS_TOPIC_TRUMP_FAMILY: z.string().optional(),
  HCS_TOPIC_CONGRESS: z.string().optional(),
  HCS_TOPIC_AGENCIES: z.string().optional(),
  HCS_TOPIC_CRYPTO: z.string().optional(),
  STAGEHAND_ENV: z.enum(["LOCAL", "BROWSERBASE"]).default("LOCAL"),
  BROWSERBASE_API_KEY: z.string().optional(),
  BROWSERBASE_PROJECT_ID: z.string().optional(),
  MOCK_INGESTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const webEnvSchema = baseSchema.extend({
  HEDERA_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
