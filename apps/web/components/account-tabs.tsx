"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TweetCard } from "@/components/tweet-card";
import { RecentDeletionsFeed } from "@/components/recent-deletions-feed";
import type { DeletionRow } from "@/components/recent-deletions-feed";

interface TweetRow {
  id: string;
  tweetId: string;
  content: string;
  tweetType: string;
  isDeleted: boolean;
  postedAt: Date;
  mediaUrls?: string[] | null;
}

interface AccountTabsProps {
  tweets: TweetRow[];
  deletions: DeletionRow[];
  totalTweets: number;
  totalDeletions: number;
  username: string;
  currentPage: number;
  totalPages: number;
}

export function AccountTabs({ tweets, deletions, totalTweets, totalDeletions, username, currentPage, totalPages }: AccountTabsProps) {
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
          <>
            <div className="flex flex-col gap-3">
              {tweets.map((tweet) => (
                <TweetCard key={tweet.id} tweet={tweet} username={username} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  {currentPage > 1 && (
                    <Link
                      href={`/accounts/${username}?page=${currentPage - 1}`}
                      className="text-sm px-3 py-1.5 rounded border hover:bg-muted transition-colors"
                    >
                      ← Previous
                    </Link>
                  )}
                  {currentPage < totalPages && (
                    <Link
                      href={`/accounts/${username}?page=${currentPage + 1}`}
                      className="text-sm px-3 py-1.5 rounded border hover:bg-muted transition-colors"
                    >
                      Next →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </TabsContent>
      <TabsContent value="deletions">
        <RecentDeletionsFeed deletions={deletions} />
      </TabsContent>
    </Tabs>
  );
}
