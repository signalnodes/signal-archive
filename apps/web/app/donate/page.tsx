// /donate redirects to /support via next.config.ts redirects.
// This page is a fallback in case the redirect is bypassed.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DonatePage() {
  redirect("/support");
}
