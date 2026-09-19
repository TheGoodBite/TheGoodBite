"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  Leaf,
  Loader2,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Star,
  Trash2,
  X,
  Zap
} from "lucide-react";
import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { DIET_MODES, type DietMode, type RankedProduct, type SearchProductsResponse } from "@/lib/types";
import { cn, uniqueStrings } from "@/lib/utils";

import { BroccoliBiteLogo } from "@/components/BroccoliBiteLogo";

type ResultItem = SearchProductsResponse["items"][number];
type ListRecord = {
  id: string;
  name: string;
  grocery_list_items?: Array<{ id: string; query: string; sort_order: number; is_active: boolean }>;
};

const DIET_LABELS: Record<DietMode, string> = {
  high_protein: "High protein",
  low_sugar: "Low sugar",
  diabetes_conscious: "Diabetes-conscious",
  low_sodium: "Low sodium",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  heart_conscious: "Heart-conscious",
  weight_loss_friendly: "Weight-loss friendly",
  kid_friendly: "Kid-friendly"
};

const DIET_ICONS: Record<DietMode, string> = {
  high_protein: "💪",
  low_sugar: "🍬",
  diabetes_conscious: "🩺",
  low_sodium: "🧂",
  vegetarian: "🥕",
  vegan: "🌱",
  gluten_free: "🌾",
  heart_conscious: "❤️",
  weight_loss_friendly: "⚖️",
  kid_friendly: "👶"
};

export default function Dashboard() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode] = useState(!supabase);
  const [email, setEmail] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [items, setItems] = useState(["mac and cheese", "potato chips", "greek yogurt"]);
  const [dietModes, setDietModes] = useState<DietMode[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [lists, setLists] = useState<ListRecord[]>([]);
  const [showLists, setShowLists] = useState(false);
  const [boughtIds, setBoughtIds] = useState<Set<string>>(new Set());
  const [showMagicLink, setShowMagicLink] = useState(false);

  const signedIn = demoMode || Boolean(session);
  const accessToken = demoMode ? "dev-token" : session?.access_token;

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  function notify(text: string, type: "info" | "success" | "error" = "info") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
  }

  async function sendMagicLink() {
    if (!supabase || !email) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) {
      notify(error.message, "error");
    } else {
      notify("Magic link sent! Check your email.", "success");
      setShowMagicLink(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setIsPaid(false);
    setResults([]);
    setBoughtIds(new Set());
  }

  function addItems(raw: string) {
    const parsed = raw
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (parsed.length === 0) return;
    setItems((current) => uniqueStrings([...current, ...parsed]));
    setItemInput("");
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleDietMode(mode: DietMode) {
    if (!isPaid) {
      notify("Diet Mode Packs are included with the paid plan. Upgrade below!", "info");
      return;
    }
    setDietModes((current) => (current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode]));
  }

  async function searchProducts() {
    if (!signedIn || !accessToken) {
      notify("Sign in to search product options.", "error");
      return;
    }

    setIsSearching(true);
    setMessage(null);
    try {
      const response = await fetch("/api/search-products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          items,
          dietModes,
          limitPerItem: isPaid ? 10 : 5
        })
      });
      const data = (await response.json()) as SearchProductsResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Search failed.");

      setResults(data.items);
      setIsPaid(data.entitlement.isPaid);
      if (!data.entitlement.isPaid && dietModes.length > 0) {
        setDietModes([]);
        notify("Diet modes are paid-only and were ignored for this search.", "info");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Search failed.", "error");
    } finally {
      setIsSearching(false);
    }
  }

  async function upgrade(interval: "monthly" | "yearly") {
    if (!accessToken) return;
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ interval })
    });
    const data = (await response.json()) as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else notify(data.error ?? "Checkout is not configured yet.", "error");
  }

  async function saveCurrentList() {
    if (!accessToken) return;
    const response = await fetch("/api/lists", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: `Grocery list ${new Date().toLocaleDateString()}`, items })
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      notify(data.error ?? "Saved lists are a paid feature.", "error");
      return;
    }
    notify("List saved successfully!", "success");
    await loadLists();
  }

  async function loadLists() {
    if (!accessToken) return;
    const response = await fetch("/api/lists", {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    const data = (await response.json()) as { lists?: ListRecord[]; error?: string };
    if (!response.ok) {
      notify(data.error ?? "Saved lists are a paid feature.", "error");
      return;
    }
    setLists(data.lists ?? []);
    setShowLists(true);
  }

  async function markBought(query: string, product: RankedProduct) {
    if (!accessToken) return;
    if (!isPaid) {
      notify("Bought history is a paid feature. Upgrade to track what you buy!", "info");
      return;
    }
    const response = await fetch("/api/bought-products", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        query,
        product: {
          provider: product.provider,
          providerProductId: product.providerProductId,
          upc: product.upc,
          title: product.title,
          brand: product.brand,
          estimatedPrice: product.estimatedPrice,
          imageUrl: product.imageUrl,
          productUrl: product.productUrl
        }
      })
    });
    const data = (await response.json()) as { error?: string };
    if (response.ok) {
      setBoughtIds((prev) => new Set([...prev, product.providerProductId]));
      notify("Marked as bought! 🛒", "success");
    } else {
      notify(data.error ?? "Couldn't record that. Try again.", "error");
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">

        {/* ── Apple-inspired Glass Header ── */}
        <header className="sticky top-0 z-40 relative flex flex-col gap-4 overflow-hidden rounded-[2rem] border border-black/[0.05] apple-glass p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-sm">
              <BroccoliBiteLogo className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-[#86868B]">
                OnlyGoodBites
              </p>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-[#1D1D1F] sm:text-3xl">
                Smarter Grocery Picks
              </h1>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-2">
            {signedIn ? (
              <>
                <span className="flex items-center gap-1.5 rounded-full bg-[#F5F5F7] px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] border border-black/[0.04]">
                  {demoMode ? (
                    <><Zap className="h-3.5 w-3.5 text-amber-500" /> Demo mode</>
                  ) : (
                    <><Check className="h-3.5 w-3.5 text-[#34C759]" /> {session?.user.email}</>
                  )}
                </span>
                {isPaid && (
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-1.5 text-xs font-black text-amber-950 shadow-sm">
                    <Crown className="h-3.5 w-3.5" /> Paid
                  </span>
                )}
                <button
                  className="flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-[#F5F5F7] px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] transition hover:bg-black hover:text-white"
                  onClick={signOut}
                  id="sign-out-btn"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </>
            ) : (
              <AuthControls
                email={email}
                setEmail={setEmail}
                signInWithGoogle={signInWithGoogle}
                sendMagicLink={sendMagicLink}
                supabase={supabase}
                showMagicLink={showMagicLink}
                setShowMagicLink={setShowMagicLink}
              />
            )}
          </div>
        </header>

        {/* ── Toast notification ── */}
        {message && (
          <div
            className={cn(
              "fade-in mt-4 flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-sm",
              message.type === "success" && "border border-emerald-200 bg-emerald-50 text-emerald-900",
              message.type === "error"   && "border border-red-200   bg-red-50   text-red-900",
              message.type === "info"    && "border border-amber-200  bg-amber-50  text-amber-900"
            )}
            role="alert"
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="shrink-0 rounded-full p-1 opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Main layout ── */}
        <section className="mt-6 grid gap-5 lg:grid-cols-[400px_1fr]">

          {/* ── Sidebar: Grocery list editor + diet modes ── */}
          <aside className="h-fit space-y-4">

            {/* List editor card */}
            <div className="rounded-[2rem] border border-stone-200/80 bg-white/90 p-5 shadow-sm shadow-stone-900/5 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-stone-950">Grocery list</h2>
                  <p className="mt-0.5 text-xs font-medium text-stone-500">
                    Add items one by one, or paste a comma/newline separated list.
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-700">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  id="grocery-item-input"
                  value={itemInput}
                  onChange={(event) => setItemInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addItems(itemInput);
                  }}
                  placeholder="e.g. mac and cheese, chips…"
                  className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  id="add-item-btn"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-300/40 transition hover:from-emerald-600 hover:to-emerald-800 active:scale-95"
                  onClick={() => addItems(itemInput)}
                  aria-label="Add grocery item"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                {items.length === 0 && (
                  <p className="rounded-2xl bg-stone-50 px-4 py-3 text-center text-xs font-semibold text-stone-400">
                    Add your first grocery item above
                  </p>
                )}
                {items.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="group flex items-center gap-1.5 rounded-2xl bg-stone-50 p-2 transition hover:bg-emerald-50/50"
                  >
                    <span className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-black text-stone-600">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate px-1 text-sm font-bold capitalize text-stone-800">{item}</span>
                    <button
                      className="rounded-full p-1.5 text-stone-400 transition hover:bg-white hover:text-stone-700"
                      onClick={() => moveItem(index, -1)}
                      aria-label="Move up"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="rounded-full p-1.5 text-stone-400 transition hover:bg-white hover:text-stone-700"
                      onClick={() => moveItem(index, 1)}
                      aria-label="Move down"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="rounded-full p-1.5 text-stone-300 transition hover:bg-red-50 hover:text-red-500"
                      onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-5 grid gap-2">
                <button
                  id="search-btn"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-800 px-4 py-3.5 font-black text-white shadow-md transition hover:from-stone-800 hover:to-stone-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={searchProducts}
                  disabled={isSearching || !signedIn || items.length === 0}
                >
                  {isSearching ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Searching…</>
                  ) : (
                    <><Search className="h-5 w-5" /> Search products</>
                  )}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="save-list-btn"
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:border-stone-300"
                    onClick={saveCurrentList}
                    disabled={!signedIn}
                  >
                    Save list
                  </button>
                  <button
                    id="saved-lists-btn"
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:border-stone-300"
                    onClick={loadLists}
                    disabled={!signedIn}
                  >
                    Saved lists
                  </button>
                </div>
              </div>
            </div>

            {/* Diet mode card */}
            <div className="rounded-[2rem] border border-stone-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-stone-950">Diet Mode Packs</h3>
                  <p className="text-xs font-medium text-stone-500 mt-0.5">General food-preference filters · not medical advice.</p>
                </div>
                {!isPaid && (
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 px-2.5 py-1 text-xs font-black text-amber-950">
                    <Crown className="h-3 w-3" /> Paid
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {DIET_MODES.map((mode) => (
                  <button
                    key={mode}
                    id={`diet-mode-${mode}`}
                    onClick={() => toggleDietMode(mode)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      dietModes.includes(mode)
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50",
                      !isPaid && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <span>{DIET_ICONS[mode]}</span>
                    {DIET_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>

            {/* Upgrade card for free users */}
            {!isPaid && signedIn && <UpgradeCard upgrade={upgrade} />}
          </aside>

          {/* ── Results area ── */}
          <section className="min-w-0 space-y-5">
            {!signedIn ? (
              <SignInPrompt signInWithGoogle={signInWithGoogle} supabase={supabase} showMagicLink={showMagicLink} setShowMagicLink={setShowMagicLink} email={email} setEmail={setEmail} sendMagicLink={sendMagicLink} />
            ) : results.length === 0 ? (
              <EmptyState isSearching={isSearching} itemCount={items.length} />
            ) : (
              results.map((item, i) => (
                <div key={item.query} className="fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <ProductCarousel item={item} isPaid={isPaid} markBought={markBought} boughtIds={boughtIds} />
                </div>
              ))
            )}

            {/* Disclaimer */}
            {results.length > 0 && (
              <p className="px-2 text-xs font-medium text-stone-400">
                Prices are estimates from shopping results, not confirmed local shelf prices.
                Open Food Facts data may have gaps; nutrition signals are informational only.
              </p>
            )}
          </section>
        </section>

        {/* ── Saved lists drawer ── */}
        {showLists && (
          <div
            className="fixed inset-0 z-20 bg-stone-950/40 p-4 backdrop-blur-sm"
            onClick={() => setShowLists(false)}
          >
            <div
              className="ml-auto h-full max-w-sm overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">Saved lists</h2>
                <button
                  className="rounded-full bg-stone-100 p-2 text-stone-600 transition hover:bg-stone-200"
                  onClick={() => setShowLists(false)}
                  aria-label="Close saved lists"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {lists.length === 0 ? (
                  <p className="rounded-2xl bg-stone-50 p-4 text-center text-sm font-semibold text-stone-400">
                    No saved lists yet. Save your first list!
                  </p>
                ) : (
                  lists.map((list) => (
                    <button
                      key={list.id}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50"
                      onClick={() => {
                        const nextItems =
                          list.grocery_list_items
                            ?.filter((item) => item.is_active)
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((item) => item.query) ?? [];
                        if (nextItems.length) setItems(nextItems);
                        setShowLists(false);
                        notify(`Loaded list: ${list.name}`, "success");
                      }}
                    >
                      <div className="font-black text-stone-900">{list.name}</div>
                      <div className="mt-1 text-xs font-semibold text-stone-500">
                        {list.grocery_list_items?.length ?? 0} item{(list.grocery_list_items?.length ?? 0) !== 1 ? "s" : ""}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Auth controls (header, signed-out state) ── */
function AuthControls(props: {
  email: string;
  setEmail: (value: string) => void;
  signInWithGoogle: () => void;
  sendMagicLink: () => void;
  supabase: SupabaseClient | null;
  showMagicLink: boolean;
  setShowMagicLink: (v: boolean) => void;
}) {
  if (!props.supabase) {
    return <span className="rounded-full bg-blue-50 px-3.5 py-2 text-sm font-bold text-blue-800 ring-1 ring-blue-200">Demo auth active</span>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        id="google-sign-in-btn"
        className="flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-black text-white transition hover:bg-stone-800"
        onClick={props.signInWithGoogle}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
      <button
        className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3.5 py-2 text-sm font-bold text-stone-600 transition hover:bg-stone-50"
        onClick={() => props.setShowMagicLink(!props.showMagicLink)}
      >
        Email link
      </button>
      {props.showMagicLink && (
        <div className="flex gap-2">
          <input
            id="magic-link-email-input"
            value={props.email}
            onChange={(event) => props.setEmail(event.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") props.sendMagicLink(); }}
            placeholder="you@example.com"
            type="email"
            className="w-44 rounded-full border border-stone-200 px-3.5 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
          />
          <button
            id="send-magic-link-btn"
            className="rounded-full bg-stone-100 px-3.5 py-2 text-sm font-black text-stone-700 transition hover:bg-stone-200"
            onClick={props.sendMagicLink}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Full-page sign-in prompt for unauthenticated users ── */
function SignInPrompt(props: {
  signInWithGoogle: () => void;
  supabase: SupabaseClient | null;
  showMagicLink: boolean;
  setShowMagicLink: (v: boolean) => void;
  email: string;
  setEmail: (v: string) => void;
  sendMagicLink: () => void;
}) {
  return (
    <div className="grid min-h-[32rem] place-items-center rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white/80 to-emerald-50/60 p-8 text-center shadow-sm backdrop-blur-sm">
      <div className="max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-xl shadow-emerald-300/50">
          <ShoppingBasket className="h-10 w-10" />
        </div>
        <h2 className="mt-6 text-3xl font-black text-stone-950">Make smarter grocery choices</h2>
        <p className="mx-auto mt-3 max-w-sm font-semibold text-stone-500">
          Sign in to search grocery items and get ranked product carousels with nutrition scores, estimated prices, and diet-fit ratings.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          {props.supabase ? (
            <>
              <button
                id="hero-google-sign-in-btn"
                className="flex w-full max-w-xs items-center justify-center gap-2.5 rounded-2xl bg-stone-950 px-6 py-3.5 font-black text-white shadow-md transition hover:bg-stone-800 active:scale-[0.98]"
                onClick={props.signInWithGoogle}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
              <button
                className="text-sm font-semibold text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
                onClick={() => props.setShowMagicLink(!props.showMagicLink)}
              >
                Sign in with email link instead
              </button>
              {props.showMagicLink && (
                <div className="flex w-full max-w-xs gap-2">
                  <input
                    value={props.email}
                    onChange={(e) => props.setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") props.sendMagicLink(); }}
                    placeholder="you@example.com"
                    type="email"
                    className="min-w-0 flex-1 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500"
                  />
                  <button
                    className="rounded-2xl bg-stone-100 px-4 py-3 text-sm font-black text-stone-700 hover:bg-stone-200"
                    onClick={props.sendMagicLink}
                  >
                    Send
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              Demo mode active — Supabase not configured. Search is available.
            </p>
          )}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-stone-100 pt-6 text-center">
          {[
            { icon: "🥗", label: "Nutrition scores" },
            { icon: "💰", label: "Price estimates" },
            { icon: "📋", label: "Saved lists" }
          ].map((f) => (
            <div key={f.label} className="text-sm font-semibold text-stone-500">
              <div className="mb-1 text-2xl">{f.icon}</div>
              {f.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Upgrade CTA card ── */
function UpgradeCard({ upgrade }: { upgrade: (interval: "monthly" | "yearly") => void }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 shadow-sm">
          <Crown className="h-5 w-5" />
        </div>
        <div>
          <div className="font-black text-amber-950">Upgrade for more</div>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-800">
            10 options per item · 100 daily searches · saved lists · bought history · Diet Mode Packs
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          id="upgrade-monthly-btn"
          className="rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-2.5 text-sm font-black text-amber-950 shadow-sm transition hover:from-amber-500 hover:to-yellow-600 active:scale-[0.97]"
          onClick={() => upgrade("monthly")}
        >
          $3.99 / month
        </button>
        <button
          id="upgrade-yearly-btn"
          className="rounded-2xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-black text-amber-900 transition hover:bg-amber-50"
          onClick={() => upgrade("yearly")}
        >
          $19 / year
        </button>
      </div>
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ isSearching, itemCount }: { isSearching: boolean; itemCount: number }) {
  return (
    <div className="grid min-h-[32rem] place-items-center rounded-[2rem] border border-dashed border-stone-200 bg-white/60 p-8 text-center backdrop-blur-sm">
      <div>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400">
          {isSearching ? (
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
          ) : (
            <Sparkles className="h-10 w-10 text-emerald-500" />
          )}
        </div>
        <h2 className="mt-5 text-2xl font-black text-stone-800">
          {isSearching ? "Finding the best picks…" : "Ready to search"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm font-semibold text-stone-400">
          {isSearching
            ? "Fetching product options and enriching with nutrition data."
            : itemCount === 0
            ? "Add grocery items to your list, then hit Search products."
            : `Hit "Search products" to compare ${itemCount} item${itemCount !== 1 ? "s" : ""} with ranked options.`}
        </p>
      </div>
    </div>
  );
}

/* ── Product carousel for one grocery item ── */
function ProductCarousel({
  item,
  isPaid,
  markBought,
  boughtIds
}: {
  item: ResultItem;
  isPaid: boolean;
  markBought: (query: string, product: RankedProduct) => void;
  boughtIds: Set<string>;
}) {
  return (
    <section className="rounded-[2rem] border border-stone-200/80 bg-white/90 p-5 shadow-sm shadow-stone-900/5 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-600">
            <Search className="h-3 w-3" /> Grocery item
          </p>
          <h2 className="text-2xl font-black capitalize text-stone-950">{item.query}</h2>
          <p className="mt-0.5 text-xs font-semibold text-stone-400">{item.options.length} option{item.options.length !== 1 ? "s" : ""} found</p>
        </div>
        {item.error && (
          <span className="rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-700 ring-1 ring-red-200">
            {item.error}
          </span>
        )}
      </div>

      <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-3">
        {item.options.length === 0 && !item.error && (
          <p className="rounded-2xl bg-stone-50 px-6 py-8 text-sm font-semibold text-stone-400">
            No results found for this item.
          </p>
        )}
        {item.options.map((product, i) => (
          <div key={product.providerProductId} className="pop-in" style={{ animationDelay: `${i * 40}ms` }}>
            <ProductCard
              product={product}
              isPaid={isPaid}
              query={item.query}
              onBought={markBought}
              alreadyBought={boughtIds.has(product.providerProductId)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Individual product card ── */
function ProductCard({
  product,
  isPaid,
  query,
  onBought,
  alreadyBought
}: {
  product: RankedProduct;
  isPaid: boolean;
  query: string;
  onBought: (query: string, product: RankedProduct) => void;
  alreadyBought: boolean;
}) {
  return (
    <article className="w-[260px] flex-shrink-0 bg-[#F5F5F7] border border-black/[0.04] rounded-3xl p-4 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5">
      <div>
        {/* Aspect ratio 1:1 image container on white background */}
        <div className="relative bg-white rounded-2xl p-2 mb-3 shadow-sm aspect-square flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              className="max-h-full max-w-full object-contain transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
          ) : (
            <ShoppingBasket className="h-10 w-10 text-slate-300" />
          )}

          {/* Health Score Pill */}
          <div className="absolute right-2 top-2 bg-[#34C759] text-white text-xs font-bold font-num px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
            <span>{product.overallScore}</span>
            <span className="text-[10px] opacity-80">/100</span>
          </div>

          {alreadyBought && (
            <div className="absolute left-2 top-2 bg-[#34C759] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Check className="h-3 w-3" /> Bought
            </div>
          )}
        </div>

        {/* Title and seller */}
        <p className="line-clamp-2 min-h-10 text-xs font-bold text-[#1D1D1F] leading-snug">{product.title}</p>
        <p className="mt-0.5 text-[11px] font-medium text-[#86868B] truncate">{product.seller ?? product.brand ?? "Grocery item"}</p>

        {/* Price & Nutrition signals */}
        <div className="mt-2.5 flex items-center justify-between gap-1">
          <span className="font-num text-sm font-semibold text-[#1D1D1F]">
            {product.estimatedPrice === null
              ? "Est. ?"
              : `$${product.estimatedPrice.toFixed(2)} est.`}
          </span>
          <div className="flex gap-1">
            <NutriBadge score={product.health.nutriScore} />
            {product.health.novaGroup && <NovaBadge nova={product.health.novaGroup} />}
          </div>
        </div>

        {/* Diet Fit Badges */}
        {product.dietFit.matchedModes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {product.dietFit.matchedModes.map((mode) => (
              <span
                key={mode}
                className="bg-white text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md border border-black/[0.06] flex items-center gap-1"
              >
                <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" /> {DIET_LABELS[mode]}
              </span>
            ))}
          </div>
        )}

        {/* Explanation */}
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#86868B] line-clamp-2">{product.explanation}</p>
      </div>

      {/* Bought This Button (Idle vs Active state) */}
      <div className="mt-4 flex gap-2">
        <button
          id={`bought-btn-${product.providerProductId}`}
          className={cn(
            "flex-1 rounded-2xl py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
            alreadyBought
              ? "bg-[#34C759]/10 text-[#248A3D] border border-[#34C759]/30"
              : isPaid
              ? "bg-black text-white hover:bg-[#1C1C1E] active:scale-95 shadow-sm"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          )}
          onClick={() => onBought(query, product)}
        >
          {alreadyBought ? (
            <><Check className="h-3.5 w-3.5" /> Bought this ✓</>
          ) : isPaid ? (
            <><ShieldCheck className="h-3.5 w-3.5" /> Bought this</>
          ) : (
            <><Crown className="h-3.5 w-3.5 text-amber-400" /> Paid only</>
          )}
        </button>

        {product.productUrl && (
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-2xl border border-black/[0.08] bg-white px-2.5 py-2.5 text-[#86868B] transition hover:text-[#1D1D1F]"
            aria-label="View product website"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  );
}

/* ── Nutri-score badge ── */
function NutriBadge({ score }: { score: string }) {
  const colors: Record<string, string> = {
    a: "bg-emerald-500 text-white",
    b: "bg-lime-500 text-white",
    c: "bg-yellow-400 text-yellow-950",
    d: "bg-orange-500 text-white",
    e: "bg-red-600 text-white",
    unknown: "bg-stone-200 text-stone-500"
  };
  return (
    <span className={cn("grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black", colors[score] ?? colors.unknown)}>
      {score === "unknown" ? "?" : score.toUpperCase()}
    </span>
  );
}

/* ── NOVA group badge ── */
function NovaBadge({ nova }: { nova: number }) {
  const color = nova <= 2 ? "bg-emerald-100 text-emerald-800" : nova === 3 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return (
    <span className={cn("grid h-6 w-9 place-items-center rounded-lg text-[10px] font-black", color)}>
      N{nova}
    </span>
  );
}
