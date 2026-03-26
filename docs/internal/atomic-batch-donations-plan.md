# Atomic Batch Donations --- Implementation Plan

Context: Hedera Hackathon entry for Signal Archive Goal: Replace the
current donate‑then‑verify flow with a single atomic batch transaction
combining donation transfer + NFT supporter badge + HCS receipt.

------------------------------------------------------------------------

## Executive Summary

The current donation flow requires a wallet transfer followed by
server-side verification through mirror nodes. The supporter badge is
currently UI-only and donations do not produce an on‑chain receipt.

This upgrade replaces that flow with a **single Hedera Atomic Batch
Transaction (HIP‑551)** containing:

1.  Donation transfer (HBAR or USDC)
2.  NFT supporter badge mint + transfer (if threshold met)
3.  HCS donation receipt

If any step fails the entire transaction fails.

This demonstrates: - HTS transfers - HTS NFT minting - HCS receipts -
HIP‑551 atomic batching

------------------------------------------------------------------------

## Core Architecture

Client → Prepare → Wallet Signature → Execute → Hedera Batch

Prepare phase constructs inner transactions and returns the user's
unsigned transfer.

Wallet signs the transfer.

Execute phase assembles the batch and submits it atomically.

------------------------------------------------------------------------

## Transaction Templates

### Template A --- Donation Only

Used when donation is below supporter threshold.

1.  TransferTransaction (user → treasury)
2.  TopicMessageSubmitTransaction (operator → HCS)

### Template B --- Donation + Badge

Used when donation ≥ threshold and user does not already own badge.

1.  TransferTransaction (user → treasury)
2.  TokenMintTransaction (operator)
3.  TransferTransaction (operator treasury → user)
4.  TopicMessageSubmitTransaction (operator)

### Template B2 --- Donation + Badge + Association

If badge token association is missing:

1.  TokenAssociateTransaction (user)
2.  TransferTransaction (user → treasury)
3.  TokenMintTransaction (operator)
4.  TransferTransaction (operator → user)
5.  TopicMessageSubmitTransaction (operator)

------------------------------------------------------------------------

## Two‑Phase API

POST /api/donations/prepare

Server: - validates request - determines template - locks HBAR/USD
rate - batchifies inner transactions - operator signs mint + receipt -
returns user transaction bytes

POST /api/donations/execute

Server: - verifies signed transaction - assembles batch - executes
batch - records donation - returns confirmation

------------------------------------------------------------------------

## Fallback Architecture

If wallet signing of batchified inner transactions fails:

1.  User executes donation transfer normally.
2.  Server executes batch containing:
    -   badge mint
    -   HCS receipt

This preserves most functionality for the hackathon demo while still
demonstrating HIP‑551.

------------------------------------------------------------------------

## HCS Receipt Schema

{ "version": 1, "type": "donation_receipt", "batch_transaction_id":
"...", "asset": "HBAR", "amount": 100, "amount_usd": 5.25,
"supporter_awarded": true, "badge_serial": 42, "threshold_usd": 5,
"rate_hbar_usd": 0.0525 }

------------------------------------------------------------------------

## Dynamic Pricing

Threshold: \$5 USD.

HBAR donations convert using CoinGecko price API.

Rate is locked during prepare phase and recorded in receipts.

------------------------------------------------------------------------

## Security

Batch store includes:

-   batchId
-   accountId
-   asset
-   amount
-   template
-   locked rate
-   expiry timestamp

Execute endpoint verifies:

-   payer matches expected account
-   transfer amount matches expected amount
-   recipient is treasury

Batch IDs are single‑use.

------------------------------------------------------------------------

## Database Updates

Donations table additions:

-   hbar_rate
-   template
-   badge_serial
-   batch_transaction_id
-   prepared_at

Supporters table additions:

-   badge_token_id
-   badge_serial
-   badge_awarded_at

------------------------------------------------------------------------

## Implementation Order

Day 0: - Spike wallet signing of batchified transaction - Test token
association behavior

Day 1: - DB schema migration - Create badge token - Create donation
topic - Implement rate service

Day 2: - Batch store - prepare endpoint - execute endpoint

Day 3: - Client integration - Wallet signing flow - UI updates

Day 4: - Testnet end‑to‑end test - error handling - hackathon demo
polish

------------------------------------------------------------------------

## Hackathon Demonstration

This feature demonstrates three Hedera services inside one atomic
transaction:

HTS Transfer\
HTS NFT Mint\
HCS Receipt

No smart contracts required.
