export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold">Tweet Accountability Archive</h1>
      <p className="mt-4 text-lg text-gray-600 max-w-xl text-center">
        Monitoring, recording, and cryptographically attesting tweets from public figures.
        Proof anchored to the Hedera Consensus Service.
      </p>
      <div className="mt-8 flex gap-4">
        <a href="/accounts" className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">
          Tracked Accounts
        </a>
        <a href="/deletions" className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
          Deletion Feed
        </a>
      </div>
    </main>
  );
}
