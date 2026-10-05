"use client";

import { useId, useState } from "react";
import { ImageOff } from "lucide-react";
import type { RankedProduct } from "@/lib/types";

export function ProductImage({ product }: { product: RankedProduct }) {
  const [failedSource, setFailedSource] = useState<string>();
  return product.imageUrl && failedSource !== product.imageUrl ? (
    <img
      src={product.imageUrl}
      alt={product.title}
      loading="lazy"
      onError={() => setFailedSource(product.imageUrl)}
    />
  ) : (
    <span className="image-fallback">
      <ImageOff size={24} />
      <span>No photo</span>
    </span>
  );
}

export function NutriScoreBadge({ product }: { product: RankedProduct }) {
  const rawGrade = product.health.nutriScore;
  const grade = ["a", "b", "c", "d", "e"].includes(rawGrade) ? rawGrade : "unknown";
  const label = grade === "unknown" ? "Nutri-Score unavailable" : `Nutri-Score ${grade.toUpperCase()}`;
  return (
    <span className={`nutri-score nutri-score-${grade}`} title={label} aria-label={label}>
      <span aria-hidden="true">Nutri</span>
      <strong aria-hidden="true">{grade === "unknown" ? "?" : grade.toUpperCase()}</strong>
    </span>
  );
}

export function priceLabel(product: RankedProduct) {
  return !Number.isFinite(product.estimatedPrice)
    ? "Price unknown"
    : `$${product.estimatedPrice!.toFixed(2)}`;
}

export function priceLocationExplanation(product: RankedProduct) {
  const price = product.priceObservation;
  return price?.locationMatch === "state"
    ? `Observed in ${price.locality || price.postalCode}, ${price.state}, on ${price.observedAt}. This price is from your state, not your exact ZIP (${price.requestedPostalCode}). Your local price may differ.`
    : undefined;
}

export function ProductPrice({
  product,
  focusable = false,
}: {
  product: RankedProduct;
  focusable?: boolean;
}) {
  const explanation = priceLocationExplanation(product);
  const tooltipId = useId();
  return explanation ? (
    <span
      className="price-location"
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={tooltipId}
    >
      {priceLabel(product)} <small>{product.priceObservation?.state} price ⓘ</small>
      <span className="price-tooltip" role="tooltip" id={tooltipId}>
        {explanation}
      </span>
    </span>
  ) : (
    <span>{priceLabel(product)}</span>
  );
}
