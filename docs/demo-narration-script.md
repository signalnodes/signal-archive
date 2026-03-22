# Signal Archive - Demo Narration Script
## Hedera Apex Hackathon Submission

**Target runtime:** 2:20 - 2:30
**Word count:** ~290 words
**TTS note:** Written for ElevenLabs spoken delivery at ~120-130 wpm. Punctuation drives pacing. Do not add pauses manually — let the periods and sentence breaks do the work.

---

## BEAT 1 - Homepage
*Screen hold: 20 seconds*

Public officials delete tweets every day. Statements with financial consequences. Policy reversals. Direct contradictions of the public record.

Gone. Unless someone was watching.

Signal Archive monitors high-value public figures on X. Every statement is archived, cryptographically hashed, and attested to Hedera before anyone hits delete.

---

## BEAT 2 - Deletions Feed
*Screen hold: 25 seconds*

This is the deletion feed.

What you are looking at is a real deletion from the official White House account, detected on March 20th, 2026. Our AI scored it seven out of ten for public interest significance.

A real account. A real deletion. A timestamped severity score. Not a simulation.

---

## BEAT 3 - Deletion Detail
*Screen hold: 25 seconds*

Here is the archived statement.

"Democrats holding TSA officers hostage for political purposes is irresponsible and dangerous."

It was posted by the White House. Then deleted. Without Signal Archive, this would just be a hole in the public record. Instead, we have it. Permanently.

---

## BEAT 4 - Verify Page
*Screen hold: 30 seconds*

But why should you trust us? We run the database. We could fabricate this.

That is exactly the right question.

The moment Signal Archive first archived this tweet, it computed a SHA-256 hash of the content and submitted it to a public Hedera Consensus Service topic on mainnet. That message is permanent. Append-only. No one can alter or delete it.

Here is the proof record. Hash, consensus timestamp, sequence number. Verifiable by anyone, right now, without going through us.

---

## BEAT 5 - HashScan
*Screen hold: 25 seconds*

This is HashScan. Hedera's public ledger explorer.

That record is not on our servers. It is on the ledger. We cannot change it. The platform cannot change it. The politician cannot change it.

That is what no screenshot, no database, and no archive without a cryptographic proof layer can offer.

---

## BEAT 6 - Homepage Close
*Screen hold: 15 seconds*

Signal Archive is live today at signalarchive.org. Forty accounts tracked. Every statement attested on Hedera mainnet. Every deletion caught and scored.

Deletion is never the last word.

---

## Post-Production Notes

- Each beat label maps directly to the corresponding step in `demo-recording-plan.md`
- Screen hold times above are targets. Match them to the ElevenLabs audio output after generation.
- If ElevenLabs runs faster or slower than expected, adjust the recording pauses in editing rather than changing the script
- The quoted tweet text in Beat 3 should be read at a slightly slower pace. Consider using ElevenLabs emphasis or a pause marker before and after the quote if the platform supports it.
- "SHA-256" will be read by TTS as "SHA two fifty-six" which is correct
- "HashScan" will read naturally as written
- Do not add the topic ID number to the narration. "A public Hedera Consensus Service topic on mainnet" is sufficient and avoids an awkward number string in spoken audio
