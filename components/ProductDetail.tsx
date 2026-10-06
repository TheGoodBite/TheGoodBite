"use client";

import { useId, useState } from "react";
import {
  Check,
  ExternalLink,
  Flame,
  Droplet,
  Wheat,
  Dumbbell,
  Info,
  TriangleAlert,
} from "lucide-react";
import type { Allergen, RankedProduct } from "@/lib/types";
import { ALLERGEN_DETAILS, checkAllergens } from "@/lib/allergens";
import { nutritionFacts } from "@/lib/nutritionFacts";
import { extractTags, TAG_EXPLANATIONS } from "@/lib/tags";
import {
  ProductImage,
  ProductPrice,
  NutriScoreBadge,
  priceLocationExplanation,
} from "./ProductPresentation";

export function ProductDetail({
  product,
  allergies,
  bought,
  busy,
  onBought,
  onOptions,
  onChoose,
  chosen,
}: {
  product: RankedProduct;
  allergies: Allergen[];
  bought: boolean;
  busy: boolean;
  onBought: () => void;
  onOptions: () => void;
  onChoose?: () => void;
  chosen?: boolean;
}) {
  const [tab, setTab] = useState("Nutrition");
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const id = useId();
  const health = product.health;
  const [nutritionBasis, setNutritionBasis] = useState<"serving" | "100g">("serving");
  const displayedFacts = nutritionFacts(health, nutritionBasis);
  const n = displayedFacts.values;
  const allergens = checkAllergens(health, product.title, allergies);
  const tags = extractTags(health, product.title);
  const concernIds = new Set(["nova4", "high_sugar", "high_sodium", "sweeteners"]);
  const concerns = tags.filter((tag) => concernIds.has(tag.id));
  const positives = tags.filter((tag) => tag.color === "green" || tag.id === "non_gmo");
  const attributes = tags.filter((tag) => !concernIds.has(tag.id) && !positives.includes(tag));
  const preferenceFit = product.preferenceFit;
  const facts = [
    { label: "Calories", value: n.energyKcal, unit: "kcal", icon: Flame },
    { label: "Protein", value: n.protein, unit: "g", icon: Dumbbell },
    {
      label: "Carbohydrates",
      value: n.carbohydrates,
      unit: "g",
      icon: Wheat,
    },
    { label: "Total sugars", value: n.sugars, unit: "g", icon: Droplet },
    {
      label: "Saturated fat",
      value: n.saturatedFat,
      unit: "g",
      icon: Droplet,
    },
    {
      label: "Sodium",
      value: n.sodium == null ? undefined : n.sodium * 1000,
      unit: "mg",
      icon: Info,
    },
    { label: "Fiber", value: n.fiber, unit: "g", icon: Wheat },
  ];
  const servings = health.servingsPerContainer;
  const primaryPrice = product.priceObservation;
  const priceUrl = primaryPrice?.url || product.productUrl;
  const sellerUrl =
    priceUrl && /^https?:\/\//i.test(priceUrl) ? priceUrl : undefined;
  return (
    <div className="product-detail">
      <div className="detail-photo">
        <ProductImage product={product} />
      </div>
      {product.provider.startsWith("mock") && (
        <p className="notice">Demo example · not a verified product or price</p>
      )}
      <div className="detail-score">
        <NutriScoreBadge product={product} />
        <div>
          <strong>Open Food Facts Nutri-Score</strong>
          <span>Nutrition grade · A is most favorable; E is least favorable.</span>
        </div>
      </div>
      <details className="nutrition-explanation">
        <summary>How is this nutrition grade calculated?</summary>
        <p>Nutri-Score compares nutritional quality using a standard 100g or 100ml basis. It balances energy, sugars, saturated fat and salt against fiber, protein and qualifying plant ingredients. The formula varies by food group.</p>
        <p>Your serving changes the amounts you eat, not the grade. Processing (NOVA), organic claims, price and search relevance do not change this grade.</p>
        {health.nutriScore === "unknown" && <p>Open Food Facts has no usable Nutri-Score for this record. We do not invent one.</p>}
        {Object.entries(health.nutrientLevels ?? {}).length > 0 && (
          <ul>
            {Object.entries(health.nutrientLevels ?? {}).map(([nutrient, level]) => (
              <li key={nutrient}>{nutrient.replace("saturated-fat", "Saturated fat")}: {level} per 100g/100ml (Open Food Facts)</li>
            ))}
          </ul>
        )}
        <p className="fine-print">These nutrient levels explain individual facts; they are not a full point-by-point breakdown of the grade. Open Food Facts records can be incomplete. Check the package.</p>
      </details>
      <h2>{product.title}</h2>
      <div className="price-line">
        <span>{product.packageSize || "Size unavailable"}</span>
        <strong>
          <ProductPrice product={product} focusable />
        </strong>
        {sellerUrl && (
          <a href={sellerUrl} target="_blank" rel="noreferrer">
            {primaryPrice?.seller || product.seller || "Price source"}
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      {priceLocationExplanation(product) && (
        <p className="fine-print">{priceLocationExplanation(product)}</p>
      )}
      <p className="fine-print">
        {primaryPrice?.source === "open_prices"
          ? `Observed ${primaryPrice.observedAt} · ${primaryPrice.locality || "United States"} · Open Prices`
          : product.estimatedPrice === null
            ? "Local price and store availability not verified"
            : "Shopping estimate"}
        {servings != null && servings > 0 && product.estimatedPrice !== null
          ? ` · $${(product.estimatedPrice / servings).toFixed(2)} / serving`
          : ""}
      </p>
      {product.unitPrice && (
        <p className="fine-print">
          ${product.unitPrice.amount.toFixed(2)} / {product.unitPrice.unit}
        </p>
      )}
      {product.health.availability === "unavailable" && (
        <p className="notice">
          Nutrition lookup is temporarily unavailable. These values are not
          verified.
        </p>
      )}
      <div className="product-signals">
        {(concerns.length > 0 || !!preferenceFit?.unmet?.length) && (
          <section className="signal-group signal-concerns" aria-labelledby={`${id}-concerns`}>
            <h3 id={`${id}-concerns`}><TriangleAlert size={17} /> Things to watch</h3>
            <ul className="signal-list">
              {concerns.map((tag) => (
                <li key={tag.id}>
                  <TriangleAlert size={16} aria-hidden="true" />
                  <div>
                    <button
                      className="signal-explain-button"
                      aria-expanded={expandedTag === tag.id}
                      aria-controls={`${id}-tag-${tag.id}`}
                      onClick={() => setExpandedTag((current) => current === tag.id ? null : tag.id)}
                    >
                      {tag.label}<Info size={14} aria-hidden="true" />
                    </button>
                    {tag.id === "nova4" && <p>NOVA 4 · highest processing group</p>}
                    {expandedTag === tag.id && <p className="tag-explanation" id={`${id}-tag-${tag.id}`}>{TAG_EXPLANATIONS[tag.id]}</p>}
                  </div>
                </li>
              ))}
            </ul>
            {!!preferenceFit?.unmet?.length && <p className="signal-note">Below your preferences: {preferenceFit.unmet.join(", ")}</p>}
          </section>
        )}
        {(positives.length > 0 || !!preferenceFit?.matches.length) && (
          <section className="signal-group signal-positives" aria-labelledby={`${id}-positives`}>
            <h3 id={`${id}-positives`}><Check size={17} /> Positives & preference matches</h3>
            <div className="tags">
              {positives.map((tag) => (
                <button
                  className="tag tag-green"
                  key={tag.id}
                  aria-expanded={expandedTag === tag.id}
                  aria-controls={`${id}-tag-${tag.id}`}
                  onClick={() => setExpandedTag((current) => current === tag.id ? null : tag.id)}
                >
                  <Check size={13} aria-hidden="true" />{tag.label}<Info size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
            {positives.map((tag) => expandedTag === tag.id && <p className="tag-explanation" id={`${id}-tag-${tag.id}`} key={tag.id}>{TAG_EXPLANATIONS[tag.id]}</p>)}
            {!!preferenceFit?.matches.length && <p className="signal-note">Matches your preferences: {preferenceFit.matches.join(", ")}</p>}
          </section>
        )}
        {(attributes.length > 0 || !!preferenceFit?.unknown.length || health.novaGroup == null) && (
          <section className="signal-group signal-neutral" aria-labelledby={`${id}-attributes`}>
            <h3 id={`${id}-attributes`}><Info size={17} /> Other details</h3>
            <div className="tags">
              {attributes.map((tag) => (
                <button
                  className="tag"
                  key={tag.id}
                  aria-expanded={expandedTag === tag.id}
                  aria-controls={`${id}-tag-${tag.id}`}
                  onClick={() => setExpandedTag((current) => current === tag.id ? null : tag.id)}
                >
                  {tag.label}<Info size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
            {attributes.map((tag) => expandedTag === tag.id && <p className="tag-explanation" id={`${id}-tag-${tag.id}`} key={tag.id}>{TAG_EXPLANATIONS[tag.id]}</p>)}
            {health.novaGroup == null && <p className="signal-note">Processing level unknown</p>}
            {!!preferenceFit?.unknown.length && <p className="signal-note">Not verified: {preferenceFit.unknown.join(", ")}</p>}
          </section>
        )}
      </div>
      {allergens.length > 0 && (
        <p className="notice">
          Possible allergens:{" "}
          {allergens.map((a) => ALLERGEN_DETAILS[a].label).join(", ")}. Check
          the package.
        </p>
      )}
      <div
        className="detail-tabs"
        role="tablist"
        aria-label="Product information"
      >
        {["Nutrition", "Ingredients", "About"].map((t) => (
          <button
            key={t}
            role="tab"
            id={`${id}-${t}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(event) => {
              const tabs = ["Nutrition", "Ingredients", "About"];
              const next =
                event.key === "ArrowRight"
                  ? (tabs.indexOf(tab) + 1) % 3
                  : event.key === "ArrowLeft"
                    ? (tabs.indexOf(tab) + 2) % 3
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : -1;
              if (next >= 0) {
                event.preventDefault();
                setTab(tabs[next]);
                document.getElementById(`${id}-${tabs[next]}`)?.focus();
              }
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        className="tab-panel"
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
        tabIndex={0}
      >
        {tab === "Nutrition" &&
          (facts.every((fact) => fact.value == null) ? (
            <div className="notice">
              <h3>
                {health.availability === "unavailable"
                  ? "Nutrition lookup unavailable"
                  : "No verified nutrition match yet"}
              </h3>
              <p>
                {health.availability === "unavailable"
                  ? "The nutrition service could not complete this lookup. Try searching again shortly."
                  : "We found this shopping listing, but could not verify its nutrition facts. Check the product label or retailer listing for details."}
              </p>
              {product.productUrl && (
                <a href={product.productUrl} target="_blank" rel="noreferrer">
                  View retailer listing <ExternalLink size={14} />
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="facts-heading">
                <strong>Key facts</strong>
                {displayedFacts.servingAvailable ? (
                  <label>Show facts <select aria-label="Nutrition basis" value={nutritionBasis} onChange={(event) => setNutritionBasis(event.target.value as "serving" | "100g")}>
                    <option value="serving">Per serving</option>
                    <option value="100g">Per 100g / 100ml</option>
                  </select></label>
                ) : <span>per 100g / 100ml</span>}
              </div>
              <p className="fine-print">
                {displayedFacts.basis === "serving"
                  ? `Per serving${health.servingSize ? ` · ${health.servingSize}` : " (catalog portion)"}`
                  : displayedFacts.servingAvailable ? "Standard comparison basis" : "Serving nutrition unavailable; showing the catalog’s standard comparison basis."}
              </p>
              {facts.map(({ label, value, unit, icon: Icon }) => (
                <div className="nutrition-row" key={label}>
                  <Icon size={17} />
                  <span>{label}</span>
                  <strong>
                    {value == null
                      ? "Unknown"
                      : `${Number(value.toFixed(1))}${unit === "kcal" ? " " : ""}${unit}`}
                  </strong>
                </div>
              ))}
              <p className="fine-print">
                {health.servingSize
                  ? `Serving size: ${health.servingSize}. `
                  : ""}
                Missing values are unknown, not zero.
              </p>
            </>
          ))}
        {tab === "Ingredients" && (
          <>
            <h3>What’s inside</h3>
            <p>
              {health.ingredientsText ||
                "Ingredient information isn’t available for this product yet."}
            </p>
            <p className="fine-print">
              Always check the current package for ingredients and allergens.
            </p>
          </>
        )}
        {tab === "About" && (
          <>
            <h3>Why this option?</h3>
            <p>{product.explanation}</p>
            {health.source && (
              <p>
                Nutrition source:{" "}
                {health.source.url ? (
                  <a href={health.source.url} target="_blank" rel="noreferrer">
                    Open Food Facts
                  </a>
                ) : (
                  "Open Food Facts"
                )}{" "}
                ·{" "}
                {health.source.match === "catalog"
                  ? "nutrition catalog record"
                  : health.source.match === "barcode"
                    ? "barcode match"
                    : "brand and variant text match"}
                .<br />
                Matched: {health.source.productName}
              </p>
            )}
            <p>
              Nutrition confidence: <strong>{health.confidence}</strong>
            </p>
            <p>
              Nutri-Score: <strong>{health.nutriScore.toUpperCase()}</strong> ·
              NOVA: <strong>{health.novaGroup ?? "Unknown"}</strong>
            </p>
            <p className="fine-print">
              Product nutrition comes from Open Food Facts. Prices are attached
              only where a matching offer or observation is available. Search relevance is separate from the nutrition grade.
            </p>
            {product.dietFit.warnings.map((warning) => (
              <p className="notice" key={warning}>
                {warning}
              </p>
            ))}
          </>
        )}
      </div>
      {product.offers && product.offers.length > 1 && (
        <details className="offers">
          <summary>{product.offers.length} price sources</summary>
          {product.offers.map((offer, index) => (
            <p className="fine-print" key={index}>
              <strong>${offer.amount.toFixed(2)}</strong> ·{" "}
              {offer.seller || "Store unknown"} ·{" "}
              {offer.source === "open_prices"
                ? "Open Prices observation"
                : product.estimatedPrice === null
                  ? "Local price and store availability not verified"
                  : "Shopping estimate"}
              <br />
              {offer.observedAt.slice(0, 10)}
              {offer.locality ? ` · ${offer.locality}` : ""}
              {offer.url && /^https?:\/\//i.test(offer.url) && (
                <>
                  {" "}
                  ·{" "}
                  <a href={offer.url} target="_blank" rel="noreferrer">
                    View source
                  </a>
                </>
              )}
            </p>
          ))}
        </details>
      )}
      <div className="detail-actions">
        {onChoose && <button className="primary-button full-width" onClick={onChoose}>{chosen ? "Update chosen quantity" : "Use this product"}</button>}
        <button className="primary-button full-width" onClick={onOptions}>
          See all options
        </button>
        <button
          className="secondary-button full-width"
          disabled={bought || busy}
          onClick={onBought}
        >
          <Check size={17} />
          {bought ? "Purchase recorded" : busy ? "Recording…" : "Bought this"}
        </button>
      </div>
    </div>
  );
}
