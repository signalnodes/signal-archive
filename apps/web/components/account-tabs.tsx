"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TweetCard } from "@/components/tweet-card";
import { RecentDeletionsFeed } from "@/components/recent-deletions-feed";
import type { DeletionRow } from "@/components/recent-deletions-feed";

interface TweetEngagement {
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
}

interface TweetRow {
  id: string;
  tweetId: string;
  content: string;
  tweetType: string;
  isDeleted: boolean;
  postedAt: Date;
  engagement?: TweetEngagement | unknown;
  mediaUrls?: string[] | null;
}

interface AccountTabsProps {
  tweets: TweetRow[];
  deletions: DeletionRow[];
  totalTweets: number;
  totalDeletions: number;
  username: string;
}

export function AccountTabs({ tweets, deletions, totalTweets, totalDeletions, username }: AccountTabsProps) {
  return (
    <Tabs defaultValue="tweets">
      <TabsList className="mb-6">
        <TabsTrigger value="tweets">
          Tweets ({totalTweets.toLocaleString()})
        </TabsTrigger>
        <TabsTrigger value="deletions">
          Deletions ({totalDeletions.toLocaleString()})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tweets">
        {tweets.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No archived tweets yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {tweets.map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} username={username} />
            ))}
          </div>
        )}
      </TabsContent>
      <TabsContent value="deletions">
        <RecentDeletionsFeed deletions={deletions} />
      </TabsContent>
    </Tabs>
  );
}
