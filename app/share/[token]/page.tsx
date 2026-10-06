import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { sharedSnapshot } from "@/lib/listRepository";
import { instacartEnabled } from "@/lib/instacart";
import { SharedList } from "@/components/SharedList";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared grocery list | Meezany", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let shared;
  try { shared = await sharedSnapshot(token); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <SharedList snapshot={shared.snapshot} token={token} createdAt={shared.createdAt} shoppingEnabled={instacartEnabled()} />;
}
