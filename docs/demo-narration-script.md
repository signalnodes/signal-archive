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

Signal Archive monitors high-value public figures on X. Each statement is archived, hashed, and attested on Hedera before anyone can delete it.

---

## BEAT 2 - Deletions Feed
*Screen hold: 25 seconds*

This is the deletion feed.

A real deletion from the official White House account, detected on March twentieth, twenty twenty-six. Our AI scored it seven out of ten for public interest significance.

A real account. A real deletion. A timestamped severity score.

---

## BEAT 3 - Deletion Detail
*Screen hold: 25 seconds*

Here is the archived statement.

"Democrats holding TSA officers hostage for political purposes is irresponsible and dangerous."

It was posted by the White House, then deleted. Without Signal Archive, this becomes a hole in the public record. Instead, we have it. Permanently.

---

## BEAT 4 - Verify Page
*Screen hold: 30 seconds*

But why should you trust us? We run the database. We could fabricate this.

That is exactly the right question.

The moment Signal Archive archived this tweet, it computed a SHA-256 hash of the content. Then it submitted that hash to a public Hedera Consensus Service topic on mainnet.

That message is permanent. Written once, readable forever. No one can alter or delete it.

Here is the proof record. The hash. The consensus timestamp. The sequence number. Verifiable by anyone, right now, without going through us.

---

## BEAT 5 - HashScan
*Screen hold: 25 seconds*

This is Hash-Scan, Hedera's public ledger explorer. Hedera reaches consensus in seconds, at a fraction of a cent per message. That is why we chose it.

That record is not on our servers. It is on the ledger. We cannot change it. The platform cannot change it. The politician cannot change it.

That is the difference a cryptographic proof layer makes.

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
- "SHA-256" is handled via ElevenLabs pronunciation dictionary alias: shah two fifty-six
- "Hash-Scan" spelling forces correct two-syllable pronunciation in TTS
- Do not add the topic ID number to the narration. "A public Hedera Consensus Service topic on mainnet" is sufficient and avoids an awkward number string in spoken audio
