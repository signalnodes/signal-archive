# Hackathon Demo Video - Version 2: Self-Published Tweet

## Opening (0:00 - 0:15)
- Screen recording of signalarchive.org homepage, slow scroll
- Voiceover: "Every day, public officials delete tweets they don't want you to see. Signal Archive catches them before they disappear, and writes cryptographic proof to Hedera that the content existed."

## The Setup (0:15 - 0:40)
- Cut to: your own X account (or a test account you control) open in a browser
- Voiceover: "Let me show you exactly how this works. I'm going to post a tweet, add this account to Signal Archive's tracking list, let the system archive it, then delete the tweet and watch what happens."
- Show yourself posting the tweet. Content options:
  - A fake "policy announcement" written in politician-speak: "After careful consideration, I am announcing my full support for [something absurd]. This is the right path forward." Something that reads like a real official statement but is obviously a demo.
  - Or keep it simple and direct: "This tweet will be deleted in 10 minutes. Let's see if Signal Archive catches it." Less cinematic but more honest, and hackathon judges might respect the directness.
- Cut to: the account page on signalarchive.org showing the tweet has been ingested

## The Deletion (0:40 - 1:00)
- Voiceover: "The tweet is archived. Now I'll delete it."
- Show yourself deleting the tweet on X. Click the three dots, click delete, confirm.
- Cut to: X showing the tweet is gone
- Voiceover: "Gone from X. If this were a real official's statement, the public record would just have a hole in it. Unless someone was watching."

## The Catch (1:00 - 1:30)
- Voiceover: "Signal Archive's deletion detection worker runs on a regular cycle. It checks every archived tweet against X's oEmbed API. When a tweet no longer resolves, it gets flagged."
- Cut to: signalarchive.org showing the deletion detected. Full original content visible, deletion timestamp, severity indicator.
- Voiceover: "There it is. The full text, preserved. The deletion, logged. But the real question is: why should you trust us? We run the database. We could fabricate this. That's where Hedera comes in."

## The Proof (1:30 - 2:00)
- Cut to: the attestation detail on signalarchive.org showing the HCS transaction
- Voiceover: "The moment Signal Archive first ingested this tweet, it submitted a message to Hedera Consensus Service, topic 0.0.10301350. That message contains a hash of the tweet content, the author, the tweet ID, and the exact time we archived it. It's on Hedera's public ledger. We can't change it. We can't delete it. Nobody can."
- Cut to: HashScan showing the transaction on-chain
- Voiceover: "You can look this up yourself right now. This isn't our word for it. It's consensus."

## Scale and Vision (2:00 - 2:25)
- Cut to: the accounts grid on signalarchive.org, scrolling through tracked officials
- Voiceover: "We're tracking 40 accounts today. Members of Congress, press secretaries, political figures. The system runs 24/7 on a VPS with headless Chrome, BullMQ job queues, and a tier-based ingestion schedule. Priority accounts are checked every hour. Every tweet gets an HCS attestation. Every deletion gets caught."
- Optional: brief flash of the architecture (the about page or a simple diagram) if you have one that looks clean

## Why It Matters (2:25 - 2:45)
- Voiceover: "Journalists already track deletions manually. Researchers scrape what they can before it's gone. But none of them can prove their archive is authentic. A screenshot can be faked. A database can be edited. An HCS attestation can't. That's the gap Signal Archive fills. Public accountability, backed by Hedera."

## Close (2:45 - 2:55)
- Cut to: signalarchive.org homepage
- Voiceover: "Signal Archive. Accountability you can verify."
- End card: signalarchive.org, GitHub, topic ID

## Production Notes
- Record all browser footage at 1080p minimum, clean browser with no distracting tabs or bookmarks
- If doing voiceover live, do a dry run first. Or record screen footage silent and add VO after for more control over pacing
- The deletion detection isn't instant (runs on a cycle), so either: (a) record ingestion and deletion parts separately and cut them together, or (b) speed up the waiting portion with a visible timeskip ("30 minutes later" text overlay)
- Keep the HashScan shot long enough for judges to read the transaction details. That's your proof of technical substance, don't rush past it
