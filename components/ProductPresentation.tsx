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

export function ScoreBadge({
  product,
  large = false,
}: {
  product: RankedProduct;
  large?: boolean;
}) {
  const unknown = product.health.classification === "unknown";
  const tone = unknown
    ? "neutral"
    : product.overallScore >= 80
      ? "good"
      : product.overallScore >= 55
        ? "mixed"
        : "low";
  return (
    <span
      className={`score score-${tone} ${large ? "score-large" : ""}`}
      title="Match score: nutrition, relevance, price, and preferences"
      aria-label={`Match score ${product.overallScore} out of 100`}
    >
      {Math.round(product.overallScore)}
      {large && <small>/100</small>}
    </span>
  );
}

export function priceLabel(product: RankedProduct) {
  return product.estimatedPrice === null
    ? "Price unknown"
    : `$${product.estimatedPrice.toFixed(2)}`;
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
