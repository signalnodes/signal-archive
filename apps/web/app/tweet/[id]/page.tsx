interface TweetDetailProps {
  params: Promise<{ id: string }>;
}

export default async function TweetDetailPage({ params }: TweetDetailProps) {
  const { id } = await params;
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Tweet Detail</h1>
      <p className="mt-4 text-gray-600">Tweet {id} — content, HCS proof, and verification.</p>
    </main>
  );
}
