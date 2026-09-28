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
} from "lucide-react";
import type { Allergen, RankedProduct } from "@/lib/types";
import { ALLERGEN_DETAILS, checkAllergens } from "@/lib/allergens";
import { extractTags } from "@/lib/tags";
import {
  ProductImage,
  ProductPrice,
  ScoreBadge,
  priceLocationExplanation,
} from "./ProductPresentation";

export function ProductDetail({
  product,
  allergies,
  bought,
  busy,
  onBought,
  onOptions,
}: {
  product: RankedProduct;
  allergies: Allergen[];
  bought: boolean;
  busy: boolean;
  onBought: () => void;
  onOptions: () => void;
}) {
  const [tab, setTab] = useState("Nutrition");
  const id = useId();
  const health = product.health;
  const n = health.nutrition;
  const allergens = checkAllergens(health, product.title, allergies);
  const facts = [
    { label: "Calories", value: n.energyKcal100g, unit: "kcal", icon: Flame },
    { label: "Protein", value: n.protein100g, unit: "g", icon: Dumbbell },
    {
      label: "Carbohydrates",
      value: n.carbohydrates100g,
      unit: "g",
      icon: Wheat,
    },
    { label: "Total sugars", value: n.sugars100g, unit: "g", icon: Droplet },
    {
      label: "Saturated fat",
      value: n.saturatedFat100g,
      unit: "g",
      icon: Droplet,
    },
    {
      label: "Sodium",
      value: n.sodium100g == null ? undefined : n.sodium100g * 1000,
      unit: "mg",
      icon: Info,
    },
    { label: "Fiber", value: n.fiber100g, unit: "g", icon: Wheat },
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
        <ScoreBadge product={product} large />
        <div>
          <strong>Match score</strong>
          <span>Nutrition, price & your preferences</span>
        </div>
      </div>
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
      <div className="tags">
        {extractTags(health, product.title).map((tag) => (
          <span className={`tag tag-${tag.color}`} key={tag.id}>
            {tag.color === "green" && <Check size={13} />}
            {tag.label}
          </span>
        ))}
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
              <p className="facts-heading">
                <strong>Key facts</strong>
                <span>per 100g</span>
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
              only where a matching offer or observation is available. Match
              scores are not category-relative health scores.
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
