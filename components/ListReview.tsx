"use client";
import { useState } from "react";
import { Sheet } from "./Sheet";
import { LIST_UNITS, shoppingLines, snapshotSchema, instacartBarcode, type ItemDetails, type ShareSummary } from "@/lib/listSharing";
import { normalizeQuery } from "@/lib/utils";

export function ListReview({ mode, name, onName, items, details, checked, preferenceKey, busy, message, resultUrl, shares, onChange, onSubmit, onClose, onRevoke }: {
  mode: "share" | "shop"; name: string; onName: (name: string) => void; items: string[];
  details: Record<string, ItemDetails>; checked: string[]; preferenceKey: string; busy: boolean; message: string;
  resultUrl: string; shares: ShareSummary[];
  onChange: (query: string, change: Partial<ItemDetails>) => void;
  onSubmit: (queries: string[]) => void; onClose: () => void; onRevoke: (id: string) => void;
}) {
  const [included, setIncluded] = useState(() => items.filter(query => !checked.includes(normalizeQuery(query))));
  const [copyMessage, setCopyMessage] = useState("");
  const snapshot = snapshotSchema.safeParse({ name, items: included.map(query => ({ query, ...details[normalizeQuery(query)] })) });
  const lines = snapshot.success ? shoppingLines(snapshot.data) : [];
  const choicesChanged = included.some(query => {
    const item = details[normalizeQuery(query)];
    return item?.selectedProduct && item.chosenPreferences !== preferenceKey;
  });
  async function shareUrl(url: string, native = false) {
    try {
      if (native && navigator.share) await navigator.share({ title: name, url });
      else { await navigator.clipboard.writeText(url); setCopyMessage("Link copied."); }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setCopyMessage("Select and copy the link below.");
    }
  }
  return <Sheet title={mode === "share" ? "Share your list" : "Shop your list"} onClose={() => !busy && onClose()}>
    <p className="sheet-intro">{mode === "share" ? "Share a snapshot of these items. Later edits to your list won’t change it." : "Review what you need, then choose your store and check the matches on Instacart."}</p>
    {message && <p className="notice" role="status">{message}</p>}
    {resultUrl ? <div className="list-result">
      <h3>{mode === "share" ? "Your share link is ready" : "Your shopping link is ready"}</h3>
      <input className="text-input" aria-label={mode === "share" ? "Share link" : "Instacart link"} readOnly value={resultUrl} onFocus={event => event.target.select()} />
      {mode === "share" ? <div className="list-actions"><button className="primary-button" onClick={() => void shareUrl(resultUrl, true)}>Share link</button><button className="secondary-button" onClick={() => void shareUrl(resultUrl)}>Copy link</button></div> :
        <a className="primary-button" href={resultUrl} target="_blank" rel="noopener noreferrer">Open Instacart</a>}
      {copyMessage && <p role="status">{copyMessage}</p>}
      {mode === "share" && <p className="fine-print">Anyone with this link can view and shop this snapshot. Stop sharing below to disable access in Meezany.</p>}
    </div> : <form onSubmit={event => { event.preventDefault(); if (snapshot.success) onSubmit(included); }}>
      <fieldset disabled={busy} className="review-fields">
        <label className="field-label" htmlFor="review-name">List name</label>
        <input id="review-name" className="text-input" maxLength={120} required value={name} onChange={event => onName(event.target.value)} />
        <p className="fine-print">Checked-off items start excluded. Quantities are editable; numbers in item names are not parsed automatically.</p>
        {items.map(query => {
          const item = details[normalizeQuery(query)];
          const product = item?.selectedProduct;
          return <div className="review-item" key={item?.clientId ?? query}>
            <label className="review-include"><input type="checkbox" checked={included.includes(query)} onChange={event => setIncluded(current => event.target.checked ? [...current, query] : current.filter(value => value !== query))} /><strong>{query}</strong></label>
            {product && <div className="review-product">{product.imageUrl && <img src={product.imageUrl} alt="" referrerPolicy="no-referrer" />}<div><span>{product.title}</span>{product.packageSize && <small>{product.packageSize}</small>}<button type="button" className="text-button" onClick={() => onChange(query, { selectedProduct: null, chosenPreferences: undefined })}>Use generic item instead</button></div></div>}
            <div className="quantity-fields">
              <label>Quantity<input aria-label={`Quantity for ${query}`} type="number" min={product ? 1 : 0.001} max={10000} step={product ? 1 : "any"} required value={item?.quantity ?? 1} onChange={event => onChange(query, { quantity: Number(event.target.value) })} /></label>
              <label>Unit<select aria-label={`Unit for ${query}`} value={item?.unit ?? "each"} onChange={event => onChange(query, { unit: event.target.value as ItemDetails["unit"] })}>{(product ? ["package"] : LIST_UNITS).map(unit => <option key={unit} value={unit}>{unit === "package" ? "packages" : unit}</option>)}</select></label>
            </div>
            <small className="fine-print">{product ? instacartBarcode(product.upc) ? "Matches by product barcode when available" : "No usable barcode — matches by product name" : "Matches by grocery name"}</small>
          </div>;
        })}
        {choicesChanged && <p className="notice">Review your chosen products against your current preferences. Saved choices are not automatically rechecked or replaced.</p>}
        {snapshot.success && <p className="fine-print">{included.length} list items · {lines.length} shopping entries. Repeated product barcodes are combined when shopping.</p>}
        {mode === "shop" && snapshot.success && <details><summary>View final shopping entries</summary><ul>{lines.map((line, index) => <li key={index}>{line.name} · {line.line_item_measurements[0].quantity} {line.line_item_measurements[0].unit === "package" ? "package(s)" : line.line_item_measurements[0].unit}</li>)}</ul></details>}
        {!snapshot.success && <p className="notice">Include at least one item, enter a list name, and use valid quantities. Chosen products need whole package counts.</p>}
        <p className="fine-print">{mode === "share" ? "Only the list title, included items, quantities, and chosen product details are shared. Your ZIP, dietary preferences, prices, and account details stay private." : "Product availability and prices are confirmed on Instacart. Dietary preferences are not transferred; review generic matches and substitutions."}</p>
        <button className={`primary-button full-width ${mode === "shop" ? "instacart-button" : ""}`} disabled={busy || !snapshot.success}>{mode === "shop" && <img src="/brand/instacart-carrot.svg" alt="" />}{busy ? "Preparing…" : mode === "share" ? "Create share link" : "Shop on Instacart"}</button>
      </fieldset>
    </form>}
    {mode === "share" && shares.length > 0 && <section className="share-management"><h3>Shared snapshots</h3><p className="fine-print">Stopping sharing disables the Meezany link. Copies and Instacart links already opened remain independent.</p>{shares.map(share => <div className="share-row" key={share.id}><span>{new Date(share.created_at).toLocaleString()}{share.revoked_at && " · Disabled"}</span>{!share.revoked_at && <div className="list-actions"><button className="text-button" onClick={() => void shareUrl(`${window.location.origin}/share/${share.token}`)}>Copy link</button><button className="text-button" disabled={busy} onClick={() => onRevoke(share.id)}>Stop sharing</button></div>}</div>)}{copyMessage && <p role="status">{copyMessage}</p>}</section>}
  </Sheet>;
}
