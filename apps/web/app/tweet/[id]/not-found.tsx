import Link from "next/link";

export default function TweetNotFound() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">Tweet not found</h1>
      <p className="text-muted-foreground mb-6">
        No archived tweet exists with this ID.
      </p>
      <Link
        href="/deletions"
        className="text-sm underline underline-offset-2 hover:text-foreground"
      >
        Browse deletion feed →
      </Link>
    </div>
  );
}
