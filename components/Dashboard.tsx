"use client";

import { PreferenceControls } from "./PreferenceControls";
import { restoreProductPreferences, EXTRA_DIET_MODES } from "@/lib/preferenceStorage";
import type { ProductPreferences } from "@/lib/types";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  GripVertical,
  List,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  X,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import {
  type Allergen,
  type DietMode,
  type RankedProduct,
  type SearchProductsResponse,
} from "@/lib/types";
import { ALLERGEN_DETAILS } from "@/lib/allergens";
import { consumeSearch } from "@/lib/searchStream";
import { normalizeQuery } from "@/lib/utils";
import { MeezanyLogo } from "./MeezanyLogo";
import { Sheet } from "./Sheet";
import { ProductImage, ProductPrice, NutriScoreBadge, priceLabel } from "./ProductPresentation";
import { compareNutriScore, comparePrice } from "@/lib/scoring";
import { ProductDetail } from "./ProductDetail";

const DIET_LABELS: Record<DietMode, string> = {
  high_protein: "High protein",
  low_sugar: "Low sugar",
  low_carb: "Low carb",
  diabetes_conscious: "Diabetes-conscious",
  low_sodium: "Low sodium",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  heart_conscious: "Heart-conscious",
  weight_loss_friendly: "Weight-loss friendly",
  kid_friendly: "Kid-friendly",
  fodmap: "FODMAP (beta)",
};
type ResultItem = SearchProductsResponse["items"][number];
type SavedList = {
  id: string;
  name: string;
  grocery_list_items?: {
    id?: string;
    query: string;
    sort_order: number;
    is_active: boolean;
  }[];
};
type Selection = { query: string; product: RankedProduct };
type Overlay =
  "preferences" | "account" | "lists" | "save" | "options" | "detail" | null;
const productKey = (product: RankedProduct) =>
  `${product.provider}:${product.providerProductId}`;

export default function Dashboard() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const itemIds = useRef<Record<string, string>>({});
  const [name, setName] = useState("Weekly groceries");
  const [input, setInput] = useState("");
  const [quickMode, setQuickMode] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [optionQuery, setOptionQuery] = useState("");
  const [sort, setSort] = useState("match");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [productPreferences, setProductPreferences] = useState<ProductPreferences>({});
  const [unwantedIngredientsText, setUnwantedIngredientsText] = useState("");
  const unwantedIngredients = [...new Set(unwantedIngredientsText.split(/[,\n]/).map(value => value.trim().toLowerCase()).filter(Boolean))];
  const [dietModes, setDietModes] = useState<DietMode[]>([]);
  const [allergies, setAllergies] = useState<Allergen[]>([]);
  const [bulkPreference, setBulkPreference] = useState<
    "everyday" | "bulk" | "any"
  >("everyday");
  const [zipCode, setZipCode] = useState("");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [searchedPreferences, setSearchedPreferences] = useState("");
  const [pendingQueries, setPendingQueries] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [lists, setLists] = useState<SavedList[]>([]);
  const [email, setEmail] = useState("");
  const [bought, setBought] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const removedQueries = useRef(new Set<string>());
  const requestRef = useRef<AbortController | null>(null);
  const accessToken =
    session?.access_token ??
    (!supabase && process.env.NODE_ENV !== "production"
      ? "dev-token"
      : undefined);
  const preferenceCount = dietModes.length + allergies.length + Object.values(productPreferences).filter(value => value !== "not_important").length;
  const preferenceKey = JSON.stringify({
    productPreferences,
    unwantedIngredients,
    dietModes,
    allergies,
    zipCode,
    bulkPreference,
  });
  const stale = results.length > 0 && searchedPreferences !== preferenceKey;
  const searching = pendingQueries.length > 0;
  const visibleQueries = quickMode ? results.map((row) => row.query) : items;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setMessage(error.message);
      else setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setLists([]);
        setBought([]);
        setActiveListId(null);
        itemIds.current = {};
      }
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("meezany_preferences") || "null",
      );
      if (["everyday", "bulk", "any"].includes(saved?.bulkPreference))
        setBulkPreference(saved.bulkPreference);
      const zip = saved?.zipCode ?? localStorage.getItem("goodbite_zip") ?? "";
      if (/^\d{0,5}$/.test(zip)) setZipCode(zip);
      const avoid =
        saved?.allergies ??
        JSON.parse(localStorage.getItem("goodbite_allergies") || "[]");
      const restored = restoreProductPreferences({ ...saved, allergies: avoid });
      setProductPreferences(restored.preferences);
      setDietModes(restored.modes);
      setAllergies([]);
      if (Array.isArray(saved?.unwantedIngredients))
        setUnwantedIngredientsText(saved.unwantedIngredients.filter((value: unknown) => typeof value === "string").join(", "));

    } catch {
      /* Invalid or blocked storage should not prevent using the app. */
    }
    setPreferencesReady(true);
    return () => requestRef.current?.abort();
  }, []);
  useEffect(() => {
    if (preferencesReady) {
      try {
        localStorage.setItem("meezany_preferences", preferenceKey);
      } catch {
        /* Storage may be disabled. */
      }
    }
  }, [preferenceKey, preferencesReady]);

  function clearResults() {
    requestRef.current?.abort();
    requestRef.current = null;
    setPendingQueries([]);
    setResults([]);
    setSelection(null);
    setOptionQuery("");
    setOverlay(null);
    setMessage("");
  }
  function switchMode(quick: boolean) {
    if (quick !== quickMode) {
      clearResults();
      setQuickMode(quick);
    } else setOverlay(null);
  }
  function addItems() {
    const parsed = input
      .split(/[,\n]/)
      .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);
    if (parsed.some((s) => s.length > 160)) {
      setMessage("Keep each grocery item under 160 characters.");
      return;
    }
    const existing = new Set(items.map(normalizeQuery));
    const additions = parsed.filter((s) => {
      const key = normalizeQuery(s);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    if (items.length + additions.length > 100) {
      setMessage("A list can have up to 100 items.");
      return;
    }
    setItems((current) => [...current, ...additions]);
    setInput("");
    if (additions.length)
      void searchProducts(
        stale ? [...items, ...additions] : [...pendingQueries, ...additions],
        !stale,
      );
  }
  function renameItem(query: string, value: string) {
    const next = value.trim();
    if (!next || next === query) return;
    if (
      items.some(
        (item) =>
          item !== query && normalizeQuery(item) === normalizeQuery(next),
      )
    ) {
      setMessage("That item is already in your list.");
      return;
    }
    const key = normalizeQuery(query);
    if (itemIds.current[key]) {
      itemIds.current[normalizeQuery(next)] = itemIds.current[key];
      delete itemIds.current[key];
    }
    setItems((current) =>
      current.map((item) => (item === query ? next : item)),
    );
    setChecked((current) => current.filter((item) => item !== key));
    setResults((current) =>
      current.filter((row) => normalizeQuery(row.query) !== key),
    );
    if (selection && normalizeQuery(selection.query) === key)
      setSelection(null);
    void searchProducts(
      stale
        ? items.map((item) => (item === query ? next : item))
        : [...pendingQueries.filter((item) => item !== key), next],
      !stale,
    );
  }
  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }
  async function api(path: string, method = "GET", body?: unknown) {
    if (!accessToken) throw new Error("Sign in to continue.");
    const response = await fetch(path, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function searchProducts(requested?: string[], incremental = false) {
    const queries = [
      ...new Set(
        (
          requested ?? (quickMode ? [quickQuery.trim()].filter(Boolean) : items)
        ).map(normalizeQuery),
      ),
    ];
    if (!queries.length) {
      setMessage("Add an item to find options.");
      return;
    }
    if (!accessToken) {
      setOverlay("account");
      setMessage("Sign in to find your product options.");
      return;
    }
    if (zipCode && zipCode.length !== 5) {
      setOverlay("preferences");
      setMessage("Enter a five-digit USA ZIP code, or leave it blank.");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    removedQueries.current.clear();
    setPendingQueries(queries.map(normalizeQuery));
    setResults((current) => [
      ...(incremental
        ? current.filter((row) => !queries.includes(normalizeQuery(row.query)))
        : []),
      ...queries.map((query) => ({ query, options: [] })),
    ]);
    setSearchedPreferences(preferenceKey);
    setMessage("");
    if (!incremental) setSelection(null);
    try {
      const response = await fetch("/api/search-products", {
        method: "POST",
        signal: controller.signal,
        headers: {
          accept: "application/x-ndjson",
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: queries,
          productPreferences,
          unwantedIngredients,
          dietModes,
          allergies,
          bulkPreference,
          zipCode: zipCode || undefined,
          limitPerItem: 10,
        }),
      });
      await consumeSearch(response, (event) => {
        if (controller.signal.aborted || requestRef.current !== controller)
          return;
        if (event.type === "meta") setMessage(event.disclaimer);
        if (event.type === "item") {
          const key = normalizeQuery(event.item.query);
          if (removedQueries.current.has(key)) return;
          setResults((current) =>
            current.map((row) =>
              normalizeQuery(row.query) === key ? event.item : row,
            ),
          );
          setPendingQueries((current) =>
            current.filter((query) => query !== key),
          );
          if (event.item.options.length)
            setSelection(
              (current) =>
                current ?? {
                  query: event.item.query,
                  product: event.item.options[0],
                },
            );
        }
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setResults((current) =>
          current.map((row) =>
            queries.includes(normalizeQuery(row.query)) &&
            !row.options.length &&
            !row.error
              ? {
                  ...row,
                  error: "Search did not finish for this item. Please retry.",
                }
              : row,
          ),
        );
        setMessage(
          error instanceof Error
            ? error.message
            : "Search failed. Please try again.",
        );
      }
    } finally {
      if (requestRef.current === controller) {
        setPendingQueries([]);
        requestRef.current = null;
      }
    }
  }
  function select(query: string, product: RankedProduct) {
    setSelection({ query, product });
    setOverlay(
      window.matchMedia("(min-width: 1200px)").matches ? null : "detail",
    );
  }
  function showOptions(query: string) {
    setOptionQuery(query);
    setSort("match");
    setOverlay("options");
  }
  function openList(list: SavedList) {
    clearResults();
    setActiveListId(list.id);
    itemIds.current = Object.fromEntries(
      (list.grocery_list_items ?? [])
        .filter((item) => item.id)
        .map((item) => [normalizeQuery(item.query), item.id!]),
    );
    setName(list.name);
    setItems(
      (list.grocery_list_items || [])
        .filter((item) => item.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => item.query),
    );
    setChecked([]);
    setQuickMode(false);
  }
  async function loadLists() {
    setOverlay("lists");
    await perform(async () => {
      if (!session) throw new Error("Sign in to access saved lists.");
      const data = await api("/api/lists");
      setLists(data.lists || []);
    });
  }
  async function markBought() {
    if (!selection) return;
    const { query, product } = selection;
    await perform(async () => {
      if (!session) throw new Error("Sign in to record purchases.");
      await api("/api/bought-products", "POST", { query, product });
      setBought((current) => [...current, productKey(product)]);
      setChecked((current) => [
        ...new Set([...current, normalizeQuery(query)]),
      ]);
      setMessage("Purchase recorded.");
    });
  }
  const optionResults = [
    ...(results.find(
      (row) => normalizeQuery(row.query) === normalizeQuery(optionQuery),
    )?.options || []),
  ];
  const options =
    sort === "price"
      ? [...optionResults].sort(
          (a, b) => comparePrice(a, b) || compareNutriScore(a.health, b.health),
        )
      : sort === "nutrition"
        ? [...optionResults].sort(
            (a, b) => compareNutriScore(a.health, b.health) || comparePrice(a, b),
          )
        : optionResults;
  const detail = selection && (
    <ProductDetail
      key={productKey(selection.product)}
      product={selection.product}
      allergies={allergies}
      bought={bought.includes(productKey(selection.product))}
      busy={busy}
      onBought={markBought}
      onOptions={() => showOptions(selection.query)}
    />
  );
  const navigation = (
    <>
      <button
        className={!quickMode ? "active" : ""}
        aria-current={!quickMode ? "page" : undefined}
        onClick={() => switchMode(false)}
      >
        <List size={21} />
        <span>Grocery list</span>
      </button>
      <button
        className={quickMode ? "active" : ""}
        aria-current={quickMode ? "page" : undefined}
        onClick={() => switchMode(true)}
      >
        <Search size={21} />
        <span>Quick lookup</span>
      </button>
      <button onClick={() => setOverlay("preferences")}>
        <SlidersHorizontal size={21} />
        <span>Preferences</span>
        {preferenceCount > 0 && (
          <span className="count">{preferenceCount}</span>
        )}
      </button>
      <button onClick={loadLists}>
        <FolderOpen size={21} />
        <span>Saved lists</span>
      </button>
    </>
  );

  return (
    <div className="app-shell">
      <a href="#groceries" className="skip-link">
        Skip to grocery list
      </a>
      <aside className="sidebar">
        <MeezanyLogo />
        <nav aria-label="Main navigation">{navigation}</nav>
        <div className="sidebar-lists">
          <p className="eyebrow">YOUR LIST</p>
          <button className="current-list" onClick={() => switchMode(false)}>
            <List size={18} />
            <span>{name}</span>
          </button>
          <button
            className="text-button"
            onClick={() => {
              clearResults();
              setItems([]);
              setActiveListId(null);
              itemIds.current = {};
              setName("My grocery list");
              setChecked([]);
              setQuickMode(false);
            }}
          >
            <Plus size={19} />
            Create new list
          </button>
        </div>
        <div className="brand-note">
          <img
            src="/brand/meezany-peel.png"
            alt="An orange peel curled into the Meezany ribbon"
          />
          <h3>
            Better groceries,
            <br />
            without the homework.
          </h3>
          <p>A little clarity for every aisle.</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <MeezanyLogo />
          </div>
          <p className="desktop-tagline">A better pick starts here.</p>
          <div className="topbar-actions">
            <button
              className="location-button"
              onClick={() => setOverlay("preferences")}
            >
              <MapPin size={16} />
              {zipCode || "Set ZIP code"}
              <ChevronDown size={14} />
            </button>
            <button
              className="avatar"
              aria-label="Account"
              title="Account"
              onClick={() => setOverlay("account")}
            >
              {session?.user.email?.slice(0, 1).toUpperCase() || (
                <User size={19} />
              )}
            </button>
          </div>
        </header>
        <div className="workspace-columns">
          <main id="groceries" className="grocery-pane">
            <div className="page-heading">
              <div>
                <h1>{quickMode ? "What’s the better pick?" : name}</h1>
                <p>
                  {quickMode
                    ? "Look up one item. Explore your options."
                    : `${items.length} ${items.length === 1 ? "item" : "items"} · Better picks for your everyday shop`}
                </p>
              </div>
              {!quickMode && (
                <button
                  className="secondary-button"
                  disabled={searching || (!items.length && !activeListId)}
                  onClick={() => setOverlay("save")}
                >
                  Save list
                </button>
              )}
            </div>
            <div className="sticky-list-controls">
              <form
                className="item-entry"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (quickMode) void searchProducts();
                  else addItems();
                }}
              >
                <Search size={19} />
                {quickMode ? (
                  <input
                    aria-label="Quick lookup"
                    placeholder="Try Greek yogurt, cereal, olive oil…"
                    value={quickQuery}
                    maxLength={160}
                    onChange={(e) => setQuickQuery(e.target.value)}
                  />
                ) : (
                  <textarea
                    aria-label="Add grocery items"
                    rows={1}
                    placeholder="Add an item, or paste your grocery list…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addItems();
                      }
                    }}
                  />
                )}
                <button
                  className="primary-button"
                  disabled={
                    quickMode ? searching || !quickQuery.trim() : !input.trim()
                  }
                  type="submit"
                >
                  {quickMode ? <Search size={17} /> : <Plus size={18} />}
                  {quickMode ? "Find" : "Add"}
                </button>
              </form>
              <div className="list-toolbar">
                <button
                  className="text-button"
                  onClick={() => setOverlay("preferences")}
                >
                  <SlidersHorizontal size={16} />
                  {preferenceCount
                    ? `${preferenceCount} preference${preferenceCount === 1 ? "" : "s"}`
                    : "Make it yours"}
                </button>
                <div>
                  {!quickMode && (
                    <>
                      <button
                        className="primary-button"
                        disabled={searching || !items.length}
                        onClick={() => void searchProducts()}
                      >
                        {searching ? (
                          <Loader2 className="spin" size={16} />
                        ) : (
                          <Search size={16} />
                        )}
                        {searching ? "Finding options…" : "Find better options"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {message && (
              <div className="status-message" role="status">
                <span>{message}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss message"
                  onClick={() => setMessage("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {stale && (
              <p className="notice">
                Preferences changed. Search again to update your options.
              </p>
            )}
            {(allergies.length > 0 || Object.entries(productPreferences).some(([id, importance]) => id.startsWith("allergens_no_") && importance !== "not_important")) && (
              <p className="fine-print allergy-note">
                Allergen information can be incomplete. Always check the package
                before buying or eating.
              </p>
            )}
            <div className="grocery-list" aria-busy={searching}>
              {visibleQueries.map((query, index) => {
                const key = normalizeQuery(query);
                const result = results.find(
                  (row) => normalizeQuery(row.query) === key,
                );
                const best = result?.options[0];
                const loading = pendingQueries.includes(key);
                const complete = checked.includes(key);
                return (
                  <article
                    className={`grocery-row ${selection && normalizeQuery(selection.query) === key ? "selected" : ""} ${complete ? "completed" : ""}`}
                    key={key}
                    onDragOver={
                      !quickMode ? (e) => e.preventDefault() : undefined
                    }
                    onDrop={
                      !quickMode
                        ? (e) => {
                            e.preventDefault();
                            const payload =
                              e.dataTransfer.getData("text/meezany-index");
                            if (!payload) return;
                            const from = Number(payload);
                            if (
                              Number.isInteger(from) &&
                              from >= 0 &&
                              from < items.length
                            )
                              moveItem(from, index);
                          }
                        : undefined
                    }
                  >
                    <button
                      className={`item-check ${complete ? "is-checked" : ""}`}
                      aria-label={`${complete ? "Uncheck" : "Check off"} ${query}`}
                      aria-pressed={complete}
                      onClick={() =>
                        setChecked((current) =>
                          complete
                            ? current.filter((q) => q !== key)
                            : [...current, key],
                        )
                      }
                    >
                      {complete && <Check size={16} />}
                    </button>
                    <div className="row-summary">
                      {quickMode ? (
                        <button
                          className="row-title"
                          disabled={!best || loading}
                          onClick={() => best && select(query, best)}
                        >
                          {query}
                        </button>
                      ) : (
                        <input
                          className="row-title row-title-input"
                          aria-label={`Edit ${query}`}
                          defaultValue={query}
                          maxLength={160}
                          onBlur={(event) => {
                            renameItem(query, event.currentTarget.value);
                            event.currentTarget.value = query;
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter")
                              event.currentTarget.blur();
                            if (event.key === "Escape") {
                              event.currentTarget.value = query;
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      )}
                      <p>
                        {loading ? (
                          <>
                            <Loader2 size={13} className="spin" />
                            Finding your options…
                          </>
                        ) : result?.error ? (
                          <span className="error-text">{result.error}</span>
                        ) : best ? (
                          <>
                            Top pick · <ProductPrice product={best} /> ·{" "}
                            <NutriScoreBadge product={best} />
                          </>
                        ) : result ? (
                          result.emptyReason === "nutrition_unavailable" ? (
                            "Nutrition lookup unavailable. No products shown; try again shortly."
                          ) : result.emptyReason === "nutrition_missing" ? (
                            "No products with matched nutrition facts found."
                          ) : (
                            "No matching products found"
                          )
                        ) : (
                          "Ready to find your better pick"
                        )}
                      </p>
                    </div>
                    {best && !loading ? (
                      <div className="product-strip">
                        {result!.options.slice(0, 3).map((product) => (
                          <button
                            key={productKey(product)}
                            className={`product-thumb ${selection && productKey(selection.product) === productKey(product) ? "chosen" : ""}`}
                            onClick={() => select(query, product)}
                            aria-label={`View ${product.title}, ${priceLabel(product)}`}
                          >
                            <span className="product-thumb-photo">
                              <ProductImage product={product} />
                            </span>
                            <NutriScoreBadge product={product} />
                            <ProductPrice product={product} />
                          </button>
                        ))}
                        <button
                          className="more-options"
                          onClick={() => showOptions(query)}
                          aria-label={`See all ${result!.options.length} options for ${query}`}
                        >
                          {result!.options.length > 3
                            ? `+${result!.options.length - 3}`
                            : "All"}
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`row-placeholder ${loading ? "loading" : ""}`}
                      >
                        {loading
                          ? "Comparing products"
                          : "Nutrition · price · preferences"}
                      </span>
                    )}
                    {best && (
                      <button
                        className="icon-button row-chevron"
                        aria-label={`Options for ${query}`}
                        onClick={() => showOptions(query)}
                      >
                        <ChevronRight size={19} />
                      </button>
                    )}
                    {result?.warnings?.length ? (
                      <p className="row-warning">{result.warnings.join(" ")}</p>
                    ) : null}
                    {!quickMode && (
                      <div className="row-edit">
                        <span
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData(
                              "text/meezany-index",
                              String(index),
                            )
                          }
                          title="Drag to reorder"
                        >
                          <GripVertical size={18} />
                        </span>
                        <button
                          className="icon-button"
                          disabled={index === 0}
                          aria-label={`Move ${query} up`}
                          onClick={() => moveItem(index, index - 1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={index === items.length - 1}
                          aria-label={`Move ${query} down`}
                          onClick={() => moveItem(index, index + 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${query}`}
                          onClick={() => {
                            removedQueries.current.add(key);
                            setPendingQueries((current) =>
                              current.filter((q) => q !== key),
                            );
                            setItems(items.filter((q) => q !== query));
                            setResults(
                              results.filter(
                                (r) => normalizeQuery(r.query) !== key,
                              ),
                            );
                            if (
                              selection &&
                              normalizeQuery(selection.query) === key
                            )
                              setSelection(null);
                            setChecked(checked.filter((q) => q !== key));
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {visibleQueries.length === 0 && (
              <div className="empty-list">
                <List size={32} />
                <h2>
                  {quickMode
                    ? "One item. A little more clarity."
                    : "Good things start with a list."}
                </h2>
                <p>
                  {quickMode
                    ? "Search above to compare products, nutrition, and prices."
                    : "Type a few groceries above, or paste a list with commas or line breaks."}
                </p>
              </div>
            )}
            <p className="list-footnote">
              {results.length
                ? "Prices are estimates. Availability and product information may vary."
                : "Your list, your preferences. We’ll help with the labels."}
            </p>
          </main>
          <aside className="detail-pane" aria-label="Product details">
            {detail || (
              <div className="detail-welcome">
                <img src="/brand/meezany-peel.png" alt="" />
                <p className="eyebrow">PEEL BACK THE LABELS</p>
                <h2>
                  Same aisle.
                  <br />
                  Better choices.
                </h2>
                <p>
                  Find options for your list, then choose a product to see
                  what’s inside.
                </p>
                <div className="welcome-step">
                  <span>1</span>Add your everyday groceries
                </div>
                <div className="welcome-step">
                  <span>2</span>Make your preferences known
                </div>
                <div className="welcome-step">
                  <span>3</span>Find your better pick
                  <ArrowRight size={16} />
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation}
      </nav>
      {overlay === "preferences" && (
        <Sheet
          title="Preferences"
          onClose={() => setOverlay(null)}
          footer={
            <button
              className="primary-button full-width"
              onClick={() => setOverlay(null)}
            >
              Done
            </button>
          }
        >
          <p className="sheet-intro">
            A few preferences. More useful recommendations.
          </p>
          <PreferenceControls value={productPreferences}
            onChange={(id, importance) => setProductPreferences(current => ({ ...current, [id]: importance }))}
            unwantedIngredients={unwantedIngredientsText} onUnwantedChange={setUnwantedIngredientsText} />
          <h3>Additional goals</h3>
          {EXTRA_DIET_MODES.map((mode) => (
            <label className="switch-row" key={mode}>
              <span>{DIET_LABELS[mode]}</span>
              <input
                type="checkbox"
                role="switch"
                checked={dietModes.includes(mode)}
                onChange={() =>
                  setDietModes((current) =>
                    current.includes(mode)
                      ? current.filter((d) => d !== mode)
                      : [...current, mode],
                  )
                }
              />
              <span className="switch" />
            </label>
          ))}
          <p className="fine-print">FODMAP is beta and depends on portion and preparation.</p>
          <h3>Price & shopping</h3>
          <label className="field-label" htmlFor="bulk-preference">
            Package preference
          </label>
          <select
            id="bulk-preference"
            className="text-input"
            value={bulkPreference}
            onChange={(e) =>
              setBulkPreference(e.target.value as "everyday" | "bulk" | "any")
            }
          >
            <option value="everyday">Prefer everyday sizes</option>
            <option value="bulk">Prefer bulk & multipacks</option>
            <option value="any">Show all sizes equally</option>
          </select>
          <p className="fine-print">
            Prices are compared per unit when package sizes are known.
          </p>
          <h3>Location</h3>
          <label className="field-label" htmlFor="zip">
            USA ZIP code (optional)
          </label>
          <input
            id="zip"
            className="text-input"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="e.g. 01752"
            value={zipCode}
            maxLength={5}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ""))}
          />
          <p className="fine-print">
            Prices prefer your ZIP, then your state. Observations are dated estimates, not confirmed local shelf prices.
          </p>
        </Sheet>
      )}
      {overlay === "account" && (
        <Sheet
          title={session ? "Your account" : "Welcome to Meezany"}
          onClose={() => setOverlay(null)}
        >
          {session ? (
            <>
              <p>{session.user.email}</p>
              <button
                className="secondary-button full-width"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    const result = await supabase?.auth.signOut();
                    if (result?.error) throw result.error;
                    clearResults();
                    setSession(null);
                    setLists([]);
                    setBought([]);
                  })
                }
              >
                <LogOut size={16} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="sheet-intro">
                Sign in to find better picks and save your grocery lists.
              </p>
              {supabase ? (
                <>
                  <button
                    className="primary-button full-width"
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        const { error } = await supabase.auth.signInWithOAuth({
                          provider: "google",
                          options: { redirectTo: window.location.origin },
                        });
                        if (error) throw error;
                      })
                    }
                  >
                    Continue with Google
                  </button>
                  <div className="or-divider">or use email</div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void perform(async () => {
                        const { error } = await supabase.auth.signInWithOtp({
                          email,
                          options: { emailRedirectTo: window.location.origin },
                        });
                        if (error) throw error;
                        setMessage("Magic link sent. Check your email.");
                      });
                    }}
                  >
                    <label className="field-label" htmlFor="email">
                      Email address
                    </label>
                    <input
                      className="text-input"
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <button
                      className="secondary-button full-width"
                      disabled={busy || !email}
                    >
                      Send sign-in link
                    </button>
                  </form>
                </>
              ) : (
                <p className="notice">
                  Sign-in is not configured in this environment.{" "}
                  {accessToken
                    ? "Development search is available; saving lists and purchases requires an account."
                    : "Please configure authentication to search and save lists."}
                </p>
              )}
            </>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </Sheet>
      )}
      {overlay === "save" && (
        <Sheet title="Save your grocery list" onClose={() => setOverlay(null)}>
          <p className="sheet-intro">Save a snapshot to return to next time.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(async () => {
                if (!session) throw new Error("Sign in to save your list.");
                let savedId = activeListId;
                if (activeListId) {
                  await api(`/api/lists/${activeListId}`, "PATCH", {
                    name: name.trim(),
                    items: items.map((query, sort_order) => ({
                      id: itemIds.current[normalizeQuery(query)],
                      query,
                      sort_order,
                      is_active: true,
                    })),
                  });
                } else {
                  const data = await api("/api/lists", "POST", {
                    name: name.trim(),
                    items,
                  });
                  savedId = data.list.id;
                  setActiveListId(savedId);
                }
                const refreshed = await api("/api/lists");
                setLists(refreshed.lists || []);
                const saved = (refreshed.lists as SavedList[]).find(
                  (list) => list.id === savedId,
                );
                if (saved)
                  itemIds.current = Object.fromEntries(
                    (saved.grocery_list_items ?? [])
                      .filter((item) => item.id)
                      .map((item) => [normalizeQuery(item.query), item.id!]),
                  );
                setOverlay(null);
                setMessage("List saved.");
              });
            }}
          >
            <label className="field-label" htmlFor="list-name">
              List name
            </label>
            <input
              className="text-input"
              id="list-name"
              value={name}
              maxLength={120}
              required
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="primary-button full-width"
              disabled={busy || !name.trim()}
            >
              Save list
            </button>
          </form>
          {!session && (
            <button
              className="text-button"
              onClick={() => setOverlay("account")}
            >
              Sign in to save lists
              <ArrowRight size={16} />
            </button>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </Sheet>
      )}
      {overlay === "lists" && (
        <Sheet title="Saved lists" onClose={() => setOverlay(null)}>
          {busy ? (
            <p role="status">Loading your lists…</p>
          ) : lists.length ? (
            lists.map((list) => (
              <div className="saved-list-row" key={list.id}>
                <button onClick={() => openList(list)}>
                  <List size={18} />
                  <span>
                    <strong>{list.name}</strong>
                    <small>
                      {list.grocery_list_items?.filter((i) => i.is_active)
                        .length ?? 0}{" "}
                      items
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              </div>
            ))
          ) : (
            <p className="sheet-intro">
              Your saved lists will appear here. Save your first list to get
              started.
            </p>
          )}
          {!session && (
            <button
              className="primary-button"
              onClick={() => setOverlay("account")}
            >
              Sign in
            </button>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </Sheet>
      )}
      {overlay === "options" && (
        <Sheet title={optionQuery} wide onClose={() => setOverlay(null)}>
          <div className="options-toolbar">
            <span>{options.length} options</span>
            <label>
              Sort{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="match">Best match</option>
                <option value="price">Lowest price</option>
                <option value="nutrition">Nutri-Score</option>
              </select>
            </label>
          </div>
          <p className="sort-explanation">
            Best match orders by Open Food Facts category fit, Nutri-Score,
            product name/brand match, selected preferences and diet modes, bulk preference, then comparable unit price.
          </p>
          {stale && (
            <p className="notice">
              Search again to apply your updated preferences.
            </p>
          )}
          <div className="options-grid">
            {options.map((product) => (
              <button
                className="option-card"
                key={productKey(product)}
                onClick={() => select(optionQuery, product)}
              >
                <div className="option-photo">
                  <ProductImage product={product} />
                </div>
                <NutriScoreBadge product={product} />
                <h3>{product.title}</h3>
                <p>{product.packageSize || "Size unavailable"}</p>
                <strong><ProductPrice product={product} /></strong>
                <p className="fine-print">
                  {product.provider.startsWith("mock")
                    ? "Demo example"
                    : product.seller || "Seller unavailable"}{" "}
                  · estimated
                </p>
                <span className="option-link">
                  See why
                  <ChevronRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {overlay === "detail" && selection && (
        <Sheet title="Product details" onClose={() => setOverlay(null)}>
          {detail}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </Sheet>
      )}
    </div>
  );
}
