"use client";

import React, { useEffect } from "react";
import { X, ExternalLink, Check, AlertTriangle, ShieldAlert, Sparkles, Heart } from "lucide-react";
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

  // Score styling
  const scoreColor =
    product.overallScore >= 80
      ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
      : product.overallScore >= 55
      ? "text-amber-700 bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
      : "text-rose-700 bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800";

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
    positives.push({ label: "High Protein", detail: `${n.protein100g}g per 100g` });
  }

  if ((n.fiber100g ?? 0) >= 3) {
    positives.push({ label: "Good Source of Fiber", detail: `${n.fiber100g}g per 100g` });
  }

  if (n.sugars100g !== undefined && n.sugars100g <= 5) {
    positives.push({ label: "Low Sugar", detail: `${n.sugars100g}g per 100g` });
  } else if ((n.sugars100g ?? 0) > 15) {
    negatives.push({ label: "High Sugar", detail: `${n.sugars100g}g per 100g` });
  }

  if (n.sodium100g !== undefined && n.sodium100g <= 0.15) {
    positives.push({ label: "Low Sodium", detail: `${n.sodium100g}g per 100g` });
  } else if ((n.sodium100g ?? 0) > 0.5) {
    negatives.push({ label: "High Sodium", detail: `${n.sodium100g}g per 100g` });
  }

  if ((n.saturatedFat100g ?? 0) > 5) {
    negatives.push({ label: "High Saturated Fat", detail: `${n.saturatedFat100g}g per 100g` });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              The Good Bite Details
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
            <div className="relative w-36 h-36 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 flex items-center justify-center overflow-hidden shadow-sm">
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
                <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
                  🥦
                </div>
              )}
            </div>

            {/* Title & Price */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              {product.brand && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  {product.brand}
                </p>
              )}
              <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                {product.title}
              </h2>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                {product.estimatedPrice !== null && (
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    ${product.estimatedPrice.toFixed(2)}
                  </span>
                )}
                {priceServing && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {priceServing.formatted}
                  </span>
                )}
                {product.seller && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                    via {product.seller}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Allergy Warning Banner */}
          {matchedAllergens.length > 0 && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-200">
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
              <span className="text-4xl font-extrabold tracking-tight">{product.overallScore}</span>
              <span className="text-xs font-medium mt-1 opacity-80 uppercase tracking-wider">Overall GoodBite Score</span>
            </div>

            <div className="sm:col-span-2 p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col justify-center space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>AI Recommendation Summary</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                &ldquo;{product.explanation}&rdquo;
              </p>
              {dietFit.warnings.length > 0 && (
                <div className="pt-2 text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5">
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Extracted Quality Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Nutrition Signals Breakdown
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Positives */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-2.5">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <span>🟢</span>
                  <span>Positive Signals ({positives.length})</span>
                </h4>
                {positives.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No strong positive signals detected</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {positives.map((p, i) => (
                      <li key={i} className="flex items-start justify-between text-slate-800 dark:text-slate-200">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-right">{p.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Negatives */}
              <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-2.5">
                <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <span>🔴</span>
                  <span>Things to Watch ({negatives.length})</span>
                </h4>
                {negatives.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No major negative signals detected</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {negatives.map((p, i) => (
                      <li key={i} className="flex items-start justify-between text-slate-800 dark:text-slate-200">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-right">{p.detail}</span>
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Nutritional Values (per 100g)
              </h3>
              {health.servingSize && (
                <span className="text-xs text-slate-400">Serving size: {health.servingSize}</span>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="flex justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-600 dark:text-slate-400">Energy</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {n.energyKcal100g !== undefined ? `${n.energyKcal100g} kcal` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-600 dark:text-slate-400">Protein</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {n.protein100g !== undefined ? `${n.protein100g} g` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-600 dark:text-slate-400">Sugars</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {n.sugars100g !== undefined ? `${n.sugars100g} g` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-600 dark:text-slate-400">Saturated Fat</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {n.saturatedFat100g !== undefined ? `${n.saturatedFat100g} g` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-600 dark:text-slate-400">Fiber</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {n.fiber100g !== undefined ? `${n.fiber100g} g` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-600 dark:text-slate-400">Sodium</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {n.sodium100g !== undefined ? `${n.sodium100g} g` : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Ingredients Text */}
          {health.ingredientsText && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ingredients List
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed p-4 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl">
                {health.ingredientsText}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 flex items-center gap-3 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => onToggleBought(product.providerProductId)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
              isBought
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
            }`}
          >
            {isBought ? (
              <>
                <Check className="w-4 h-4" />
                <span>Added to Bought Items</span>
              </>
            ) : (
              <>
                <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Mark as Bought</span>
              </>
            )}
          </button>

          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all"
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
