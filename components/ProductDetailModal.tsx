"use client";

import React, { useEffect } from "react";
import { X, ExternalLink, Check, AlertTriangle, ShieldAlert, Sparkles, Heart, Info } from "lucide-react";
import type { Allergen, RankedProduct } from "@/lib/types";
import { ALLERGEN_DETAILS, checkAllergens } from "@/lib/allergens";
import { computePricePerServing } from "@/lib/pricing";
import { extractTags } from "@/lib/tags";

interface ProductDetailModalProps {
  product: RankedProduct | null;
  onClose: () => void;
  isBought: boolean;
  onToggleBought: (productId: string) => void;
  selectedAllergies?: Allergen[];
}

function formatVal(val?: number, unit = "g"): string {
  if (val === undefined || !Number.isFinite(val)) return "N/A";
  const rounded = Math.round(val * 10) / 10;
  return `${rounded} ${unit}`;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  isBought,
  onToggleBought,
  selectedAllergies = []
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!product) return null;

  const { health, dietFit } = product;
  const n = health.nutrition;
  const tags = extractTags(health, product.title);
  const matchedAllergens = checkAllergens(health, product.title, selectedAllergies);
  const priceServing = computePricePerServing(
    product.estimatedPrice,
    health.servingSize,
    health.servingsPerContainer,
    product.title
  );

  const isNutritionIncomplete =
    n.protein100g === undefined &&
    n.sugars100g === undefined &&
    n.energyKcal100g === undefined &&
    health.nutriScore === "unknown";

  // Score styling
  const scoreColor =
    product.overallScore >= 80
      ? "text-emerald-800 bg-emerald-50 border-emerald-200"
      : product.overallScore >= 55
      ? "text-amber-800 bg-amber-50 border-amber-200"
      : "text-rose-800 bg-rose-50 border-rose-200";

  // Positives & Negatives (Yuka style)
  const positives: { label: string; detail: string }[] = [];
  const negatives: { label: string; detail: string }[] = [];

  if (health.nutriScore === "a" || health.nutriScore === "b") {
    positives.push({ label: "Nutri-Score", detail: `Grade ${health.nutriScore.toUpperCase()} (High quality)` });
  } else if (health.nutriScore === "d" || health.nutriScore === "e") {
    negatives.push({ label: "Nutri-Score", detail: `Grade ${health.nutriScore.toUpperCase()} (Low quality)` });
  }

  if (health.novaGroup && health.novaGroup <= 2) {
    positives.push({ label: "Processing Level", detail: `NOVA Group ${health.novaGroup} (Minimally processed)` });
  } else if (health.novaGroup === 4) {
    negatives.push({ label: "Ultra-Processed", detail: "NOVA Group 4 (Industrial formulations & additives)" });
  }

  if ((n.protein100g ?? 0) >= 8) {
    positives.push({ label: "High Protein", detail: `${formatVal(n.protein100g)} per 100g` });
  }

  if ((n.fiber100g ?? 0) >= 3) {
    positives.push({ label: "Good Source of Fiber", detail: `${formatVal(n.fiber100g)} per 100g` });
  }

  if (n.sugars100g !== undefined && n.sugars100g <= 5) {
    positives.push({ label: "Low Sugar", detail: `${formatVal(n.sugars100g)} per 100g` });
  } else if ((n.sugars100g ?? 0) > 15) {
    negatives.push({ label: "High Sugar", detail: `${formatVal(n.sugars100g)} per 100g` });
  }

  if (n.sodium100g !== undefined && n.sodium100g <= 0.15) {
    positives.push({ label: "Low Sodium", detail: `${formatVal(n.sodium100g)} per 100g` });
  } else if ((n.sodium100g ?? 0) > 0.5) {
    negatives.push({ label: "High Sodium", detail: `${formatVal(n.sodium100g)} per 100g` });
  }

  if ((n.saturatedFat100g ?? 0) > 5) {
    negatives.push({ label: "High Saturated Fat", detail: `${formatVal(n.saturatedFat100g)} per 100g` });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-black/[0.06] overflow-hidden max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-stone-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#166534] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              The Good Bite Details
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Info Hero */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Image */}
            <div className="relative w-36 h-36 shrink-0 rounded-2xl border border-stone-200 bg-white p-2 flex items-center justify-center overflow-hidden shadow-sm">
              {product.imageUrl ? (
                // eslint-disable-next-next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/300x300/f4f7f0/166534?text=The+Good+Bite";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  🥦
                </div>
              )}
            </div>

            {/* Title & Price */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              {product.brand && (
                <p className="text-xs font-semibold text-[#166534] uppercase tracking-wide">
                  {product.brand}
                </p>
              )}
              <h2 className="text-xl font-bold text-[#1D1D1F] leading-snug">
                {product.title}
              </h2>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                {product.estimatedPrice !== null && (
                  <span className="font-num text-2xl font-extrabold text-[#1D1D1F]">
                    ${product.estimatedPrice.toFixed(2)}
                  </span>
                )}
                {priceServing && (
                  <span className="text-xs font-medium text-[#166534] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    {priceServing.formatted}
                  </span>
                )}
                {product.seller && (
                  <span className="text-xs text-[#86868B] bg-stone-100 px-2.5 py-1 rounded-md">
                    via {product.seller}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Incomplete Data Notice */}
          {isNutritionIncomplete && (
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex items-start gap-3 text-stone-700 text-xs">
              <Info className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-stone-900">Limited Nutrition Data</h4>
                <p className="mt-0.5 text-stone-500">
                  Open Food Facts currently has a partial record for this product barcode or name. Always inspect the physical package label at the store.
                </p>
              </div>
            </div>
          )}

          {/* Allergy Warning Banner */}
          {matchedAllergens.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Allergen Alert Detected</h4>
                <p className="text-xs mt-0.5 opacity-90">
                  This product contains or may contain your selected allergen(s):{" "}
                  <span className="font-semibold underline">
                    {matchedAllergens.map((a) => ALLERGEN_DETAILS[a]?.label ?? a).join(", ")}
                  </span>. Always verify physical packaging labels.
                </p>
              </div>
            </div>
          )}

          {/* Overall Health & Diet Score Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-5 rounded-2xl border flex flex-col items-center justify-center text-center ${scoreColor}`}>
              <span className="font-num text-4xl font-extrabold tracking-tight">{product.overallScore}</span>
              <span className="text-xs font-medium mt-1 opacity-80 uppercase tracking-wider">Overall GoodBite Score</span>
            </div>

            <div className="sm:col-span-2 p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] flex flex-col justify-center space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F]">
                <Sparkles className="w-4 h-4 text-[#166534]" />
                <span>AI Recommendation Summary</span>
              </div>
              <p className="text-xs text-stone-600 italic">
                &ldquo;{product.explanation}&rdquo;
              </p>
              {dietFit.warnings.length > 0 && (
                <div className="pt-2 text-[11px] text-amber-800 space-y-0.5">
                  {dietFit.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product Tag Badges */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Extracted Quality Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#F5F5F7] text-stone-800 border border-black/[0.06]"
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Yuka-Style Positive & Negative Signals */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Nutrition Signals Breakdown
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Positives */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 space-y-2.5">
                <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <span>🟢</span>
                  <span>Positive Signals ({positives.length})</span>
                </h4>
                {positives.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No strong positive signals detected</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {positives.map((p, i) => (
                      <li key={i} className="flex items-start justify-between text-stone-800">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-stone-500 text-right">{p.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Negatives */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/60 space-y-2.5">
                <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <span>🔴</span>
                  <span>Things to Watch ({negatives.length})</span>
                </h4>
                {negatives.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No major negative signals detected</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {negatives.map((p, i) => (
                      <li key={i} className="flex items-start justify-between text-stone-800">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-stone-500 text-right">{p.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Macro Nutrition Table (per 100g) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Nutritional Values (per 100g)
              </h3>
              {health.servingSize && (
                <span className="text-xs text-stone-400">Serving size: {health.servingSize}</span>
              )}
            </div>

            <div className="rounded-2xl border border-stone-200 overflow-hidden divide-y divide-stone-100 text-xs">
              <div className="flex justify-between px-4 py-2.5 bg-stone-50">
                <span className="text-stone-600">Energy</span>
                <span className="font-medium text-stone-900">
                  {formatVal(n.energyKcal100g, "kcal")}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-stone-600">Protein</span>
                <span className="font-medium text-stone-900">
                  {formatVal(n.protein100g, "g")}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-stone-50">
                <span className="text-stone-600">Sugars</span>
                <span className="font-medium text-stone-900">
                  {formatVal(n.sugars100g, "g")}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-stone-600">Saturated Fat</span>
                <span className="font-medium text-stone-900">
                  {formatVal(n.saturatedFat100g, "g")}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-stone-50">
                <span className="text-stone-600">Fiber</span>
                <span className="font-medium text-stone-900">
                  {formatVal(n.fiber100g, "g")}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-stone-600">Sodium</span>
                <span className="font-medium text-stone-900">
                  {formatVal(n.sodium100g, "g")}
                </span>
              </div>
            </div>
          </div>

          {/* Ingredients Text */}
          {health.ingredientsText && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Ingredients List
              </h3>
              <p className="text-xs text-stone-700 leading-relaxed p-4 bg-stone-50 border border-stone-200 rounded-2xl">
                {health.ingredientsText}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 flex items-center gap-3 p-4 bg-white/90 backdrop-blur-md border-t border-stone-100">
          <button
            onClick={() => onToggleBought(product.providerProductId)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
              isBought
                ? "bg-[#34C759]/15 text-[#248A3D] border border-[#34C759]/30"
                : "bg-[#34C759] text-white hover:bg-[#248A3D] shadow-md shadow-[#34C759]/20"
            }`}
          >
            {isBought ? (
              <>
                <Check className="w-4 h-4" />
                <span>Added to Bought Items</span>
              </>
            ) : (
              <>
                <Heart className="w-4 h-4" />
                <span>Mark as Bought</span>
              </>
            )}
          </button>

          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-3 px-5 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-sm font-semibold shadow-md transition-all"
            >
              <span>View Store</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
