import Link from "next/link";

export default function AccountNotFound() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">Account not found</h1>
      <p className="text-muted-foreground mb-6">
        This username is not in our tracked accounts list.
      </p>
      <Link
        href="/accounts"
        className="text-sm underline underline-offset-2 hover:text-foreground"
      >
        Browse all tracked accounts →
      </Link>
    </div>
  );
}
