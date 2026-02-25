import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-20 text-center">
      <div className="text-6xl font-mono font-bold text-muted-foreground mb-4">404</div>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-6">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className="text-sm underline underline-offset-2 hover:text-foreground">
        Return home
      </Link>
    </div>
  );
}
