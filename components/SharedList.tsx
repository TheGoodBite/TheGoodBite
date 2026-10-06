"use client";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { MeezanyLogo } from "./MeezanyLogo";
import { shoppingLines, type ListSnapshot } from "@/lib/listSharing";

export function SharedList({ snapshot, token, createdAt, shoppingEnabled }: { snapshot: ListSnapshot; token: string; createdAt: string; shoppingEnabled: boolean }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [accessToken, setAccessToken] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAccessToken(session?.access_token));
    return () => data.subscription.unsubscribe();
  }, [supabase]);
  async function act(action: "copy" | "instacart") {
    if (action === "copy" && !accessToken) { window.location.assign(`/?share=${token}`); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/shares/${token}/${action}`, { method: "POST", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      if (action === "copy") window.location.assign(`/?list=${data.listId}`);
      else { setUrl(data.url); window.open(data.url, "_blank", "noopener,noreferrer"); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="shared-list-page">
    <a href="/" aria-label="Meezany home"><MeezanyLogo /></a>
    <p className="eyebrow">Shared grocery list</p><h1>{snapshot.name}</h1>
    <p className="fine-print">Snapshot from {new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}. Later changes to the original aren’t included.</p>
    <div className="shared-items">{snapshot.items.map((item, index) => <article className="shared-item" key={index}>
      {item.selectedProduct?.imageUrl && <img src={item.selectedProduct.imageUrl} alt="" referrerPolicy="no-referrer" />}
      <div><h2>{item.query}</h2>{item.selectedProduct && <><p>{item.selectedProduct.title}</p><small>{item.selectedProduct.brand}{item.selectedProduct.packageSize ? ` · ${item.selectedProduct.packageSize}` : ""}</small></>}<p>{item.quantity} {item.unit === "package" ? "package(s)" : item.unit}</p></div>
    </article>)}</div>
    <p className="fine-print">{snapshot.items.length} list items · {shoppingLines(snapshot).length} shopping entries. Repeated product barcodes are combined when shopping.</p>
    <div className="list-actions">{shoppingEnabled && <button className="primary-button instacart-button" disabled={busy} onClick={() => void act("instacart")}><img src="/brand/instacart-carrot.svg" alt="" />{busy ? "Preparing…" : "Shop on Instacart"}</button>}<button className="secondary-button" disabled={busy} onClick={() => void act("copy")}>Save a copy</button></div>
    {url && <p><a className="primary-button" href={url} target="_blank" rel="noopener noreferrer">Open Instacart</a></p>}
    {message && <p className="notice" role="status">{message}</p>}
    <p className="fine-print">Sign in to save your own editable copy. Anyone with this link can view this snapshot.</p>
    {shoppingEnabled && <p className="fine-print">Review products, quantities, prices, and substitutions on Instacart before checkout. The sender’s dietary preferences are not included.</p>}
  </main>;
}
