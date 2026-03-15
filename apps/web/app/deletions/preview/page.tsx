import type { Metadata } from "next";
import { RecentDeletionsFeed } from "@/components/recent-deletions-feed";
import { DeletionFilters } from "@/components/deletion-filters";
import type { DeletionRow } from "@/components/recent-deletions-feed";

export const metadata: Metadata = { title: "Deletion Feed — Preview" };

const FIXTURE_DELETIONS: DeletionRow[] = [
  {
    deletion: {
      id: "preview-1",
      tweetId: "1899000000000000001",
      contentPreview:
        "The so-called 'independent' judiciary has gone rogue. We will not comply with activist judges who think they can override the will of 77 million voters. This isn't over.",
      detectedAt: new Date("2026-03-14T22:41:00Z"),
      tweetAgeHours: "0.42",
      severityScore: 9,
    },
    account: {
      id: "acc-1",
      username: "realDonaldTrump",
      displayName: "Donald Trump",
      category: "trump_family",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-2",
      tweetId: "1899000000000000002",
      contentPreview:
        "Congratulations to our partners at World Liberty Financial — the $WLFI governance vote passed 98-2. The future of American finance is being built right now.",
      detectedAt: new Date("2026-03-14T18:15:00Z"),
      tweetAgeHours: "3.25",
      severityScore: 8,
    },
    account: {
      id: "acc-2",
      username: "EricTrump",
      displayName: "Eric Trump",
      category: "trump_family",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-3",
      tweetId: "1899000000000000003",
      contentPreview:
        "I've reviewed the SEC's position on this matter. The enforcement action is being dropped. More announcements to follow.",
      detectedAt: new Date("2026-03-14T14:02:00Z"),
      tweetAgeHours: "1.08",
      severityScore: 9,
    },
    account: {
      id: "acc-3",
      username: "AGPamBondi",
      displayName: "AG Pam Bondi",
      category: "political_appointee",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-4",
      tweetId: "1899000000000000004",
      contentPreview:
        "WLFI stablecoin launch is set. Not saying when. Not saying the price. But those who are in early know.",
      detectedAt: new Date("2026-03-13T09:30:00Z"),
      tweetAgeHours: "0.18",
      severityScore: 7,
    },
    account: {
      id: "acc-4",
      username: "justinsuntron",
      displayName: "Justin Sun",
      category: "crypto_industry",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-5",
      tweetId: "1899000000000000005",
      contentPreview:
        "The press briefing is cancelled. No further comment on the FBI director situation at this time.",
      detectedAt: new Date("2026-03-13T07:14:00Z"),
      tweetAgeHours: "0.07",
      severityScore: 8,
    },
    account: {
      id: "acc-5",
      username: "PressSec",
      displayName: "Press Secretary",
      category: "white_house",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-6",
      tweetId: "1899000000000000006",
      contentPreview:
        "My amendment to the GENIUS Act stablecoin bill has been withdrawn after conversations with leadership. We'll continue working toward responsible crypto regulation.",
      detectedAt: new Date("2026-03-12T20:55:00Z"),
      tweetAgeHours: "14.3",
      severityScore: 6,
    },
    account: {
      id: "acc-6",
      username: "SenLummis",
      displayName: "Cynthia Lummis",
      category: "congress",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-7",
      tweetId: "1899000000000000007",
      contentPreview:
        "Quietly, we've cut 4 more agencies today. Nobody is reporting on it. That's fine with us.",
      detectedAt: new Date("2026-03-12T16:08:00Z"),
      tweetAgeHours: "0.55",
      severityScore: 7,
    },
    account: {
      id: "acc-7",
      username: "elonmusk",
      displayName: "Elon Musk",
      category: "political_appointee",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-8",
      tweetId: "1899000000000000008",
      contentPreview:
        "Treasury is exploring a strategic bitcoin reserve position. Nothing to announce yet. Early days.",
      detectedAt: new Date("2026-03-11T11:22:00Z"),
      tweetAgeHours: "2.1",
      severityScore: 8,
    },
    account: {
      id: "acc-8",
      username: "USTreasury",
      displayName: "US Treasury",
      category: "federal_agency",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-9",
      tweetId: null,
      contentPreview:
        "Looking forward to the state dinner next week. A few surprises in store for our guests.",
      detectedAt: new Date("2026-03-10T19:45:00Z"),
      tweetAgeHours: "48.0",
      severityScore: 3,
    },
    account: {
      id: "acc-9",
      username: "MELANIATRUMP",
      displayName: "Melania Trump",
      category: "trump_family",
      avatarUrl: null,
    },
  },
  {
    deletion: {
      id: "preview-10",
      tweetId: "1899000000000000010",
      contentPreview:
        "The World Liberty Financial token offering is open to US persons. We've confirmed compliance with counsel.",
      detectedAt: new Date("2026-03-09T08:00:00Z"),
      tweetAgeHours: "0.95",
      severityScore: 9,
    },
    account: {
      id: "acc-10",
      username: "worldlibertyfi",
      displayName: "World Liberty Financial",
      category: "wlfi",
      avatarUrl: null,
    },
  },
];

const FIXTURE_CATEGORIES = [
  "trump_family",
  "political_appointee",
  "crypto_industry",
  "white_house",
  "congress",
  "federal_agency",
  "wlfi",
];

export default function DeletionsPreviewPage() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6 px-3 py-2 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs font-mono">
        PREVIEW — fixture data for design review. Not live.
      </div>
      <h1 className="text-2xl font-bold mb-1">Deletion Feed</h1>
      <p className="text-muted-foreground mb-6">
        Reverse-chronological record of all detected tweet deletions.
      </p>
      <DeletionFilters
        categories={FIXTURE_CATEGORIES}
        activeCategory={null}
        activeSort="recent"
      />
      <div className="mt-6">
        <RecentDeletionsFeed deletions={FIXTURE_DELETIONS} />
      </div>
    </div>
  );
}
