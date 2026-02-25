interface VerifyProps {
  params: Promise<{ hash: string }>;
}

export default async function VerifyPage({ params }: VerifyProps) {
  const { hash } = await params;
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Verify Hash</h1>
      <p className="mt-4 text-gray-600">
        Verify content hash <code className="bg-gray-100 px-1 rounded">{hash}</code> against Hedera Consensus Service.
      </p>
    </main>
  );
}
