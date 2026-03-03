export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const HEDERA_NETWORK =
  (process.env.NEXT_PUBLIC_HEDERA_NETWORK as "mainnet" | "testnet") ?? "mainnet";

export const DONATION_ACCOUNT_ID =
  process.env.NEXT_PUBLIC_DONATION_ACCOUNT_ID ?? "";

export const USDC_TOKEN_ID =
  process.env.NEXT_PUBLIC_USDC_TOKEN_ID ?? "0.0.456858";
