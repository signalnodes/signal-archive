interface AccountDetailProps {
  params: Promise<{ username: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailProps) {
  const { username } = await params;
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">@{username}</h1>
      <p className="mt-4 text-gray-600">Account profile, tweets, and deletion history.</p>
    </main>
  );
}
