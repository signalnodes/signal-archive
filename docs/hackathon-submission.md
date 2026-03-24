# Hackathon Submission Materials

## Track
Open Track

## 100-Word Project Description

Signal Archive is a public accountability platform that cryptographically proves the existence of tweets from high-value public figures before they get deleted. Every tweet is archived, SHA-256 hashed, and attested to a public Hedera HCS topic in near real-time. When a deletion is detected, that too is attested on-chain. The result is an immutable, independently verifiable record that no one can alter - not the politician, not the platform, not us. With 3,000+ attestations live on Hedera mainnet, AI-powered severity scoring, and a live site tracking 40 high-value accounts, Signal Archive is accountability infrastructure for the public interest.

(99 words)

## Tech Stack
- Next.js 16 (App Router) + React 19 + Tailwind CSS v4
- BullMQ + Redis - job queue for ingestion, deletion detection, HCS submission
- PostgreSQL (Neon) + Drizzle ORM
- @hashgraph/sdk - HCS attestations, HIP-551 batch transactions, NFT minting
- @hashgraphonline/standards-sdk - HOL Registry agent registration (HCS-11)
- Claude AI (Opus) - autonomous deletion severity scoring (1-10 scale)
- Railway (web) + Hetzner VPS (worker, ingestion, Chrome CDP)

## Live Demo Link
https://signalarchive.org

## Submission Checklist
- [ ] GitHub repository + README
- [ ] Project description (100 words) - DONE (above)
- [ ] Tech stack listing - DONE (above)
- [ ] Pitch deck (PDF)
- [ ] Demo video (max 5 min, YouTube link)
- [ ] Live demo link - DONE (signalarchive.org)
