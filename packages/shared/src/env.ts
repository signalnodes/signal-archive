import { z } from "zod";

const baseSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});

export const workerEnvSchema = baseSchema.extend({
  HEDERA_OPERATOR_ID: z.string().min(1),
  HEDERA_OPERATOR_KEY: z.string().min(1),
  HEDERA_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  HEDERA_TOPIC_ID: z.string().min(1),
  SOCIALDATA_API_KEY: z.string().min(1).optional(),
  STAGEHAND_ENV: z.enum(["LOCAL", "BROWSERBASE"]).default("LOCAL"),
  BROWSERBASE_API_KEY: z.string().optional(),
  BROWSERBASE_PROJECT_ID: z.string().optional(),
  MOCK_INGESTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_SCORING_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export const webEnvSchema = baseSchema.extend({
  HEDERA_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
