import { describe, it, expect } from "vitest";
import { workerEnvSchema, webEnvSchema } from "./env";

describe("workerEnvSchema", () => {
  const validWorkerEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    HEDERA_OPERATOR_ID: "0.0.12345",
    HEDERA_OPERATOR_KEY: "302e020100...",
    HEDERA_TOPIC_ID: "0.0.99999",
    SOCIALDATA_API_KEY: "sk-123456",
  };

  it("accepts valid env vars with all required fields", () => {
    const result = workerEnvSchema.safeParse(validWorkerEnv);
    expect(result.success).toBe(true);
  });

  it("defaults HEDERA_NETWORK to testnet", () => {
    const result = workerEnvSchema.parse(validWorkerEnv);
    expect(result.HEDERA_NETWORK).toBe("testnet");
  });

  it("accepts mainnet as HEDERA_NETWORK", () => {
    const result = workerEnvSchema.parse({
      ...validWorkerEnv,
      HEDERA_NETWORK: "mainnet",
    });
    expect(result.HEDERA_NETWORK).toBe("mainnet");
  });

  it("rejects invalid HEDERA_NETWORK", () => {
    const result = workerEnvSchema.safeParse({
      ...validWorkerEnv,
      HEDERA_NETWORK: "devnet",
    });
    expect(result.success).toBe(false);
  });

  it("defaults MOCK_INGESTION to false", () => {
    const result = workerEnvSchema.parse(validWorkerEnv);
    expect(result.MOCK_INGESTION).toBe(false);
  });

  it("transforms MOCK_INGESTION 'true' string to boolean true", () => {
    const result = workerEnvSchema.parse({
      ...validWorkerEnv,
      MOCK_INGESTION: "true",
    });
    expect(result.MOCK_INGESTION).toBe(true);
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL, ...rest } = validWorkerEnv;
    const result = workerEnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing REDIS_URL", () => {
    const { REDIS_URL, ...rest } = validWorkerEnv;
    const result = workerEnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing HEDERA_OPERATOR_ID", () => {
    const { HEDERA_OPERATOR_ID, ...rest } = validWorkerEnv;
    const result = workerEnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing SOCIALDATA_API_KEY", () => {
    const { SOCIALDATA_API_KEY, ...rest } = validWorkerEnv;
    const result = workerEnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("allows optional BROWSERBASE_API_KEY", () => {
    const result = workerEnvSchema.safeParse(validWorkerEnv);
    expect(result.success).toBe(true);
  });

  it("defaults STAGEHAND_ENV to LOCAL", () => {
    const result = workerEnvSchema.parse(validWorkerEnv);
    expect(result.STAGEHAND_ENV).toBe("LOCAL");
  });
});

describe("webEnvSchema", () => {
  const validWebEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
  };

  it("accepts valid web env", () => {
    const result = webEnvSchema.safeParse(validWebEnv);
    expect(result.success).toBe(true);
  });

  it("defaults HEDERA_NETWORK to testnet", () => {
    const result = webEnvSchema.parse(validWebEnv);
    expect(result.HEDERA_NETWORK).toBe("testnet");
  });

  it("rejects invalid DATABASE_URL", () => {
    const result = webEnvSchema.safeParse({
      ...validWebEnv,
      DATABASE_URL: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing REDIS_URL", () => {
    const { REDIS_URL, ...rest } = validWebEnv;
    const result = webEnvSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
