"use client";

import { PREFERENCE_GROUPS, IMPORTANCE_LABELS } from "@/lib/preferenceDefinitions";
import { PREFERENCE_IMPORTANCE } from "@/lib/types";
import type { ProductPreferenceId, ProductPreferences, PreferenceImportance } from "@/lib/types";

export function PreferenceControls({ value, onChange, unwantedIngredients, onUnwantedChange }: {
  value: ProductPreferences;
  onChange: (id: ProductPreferenceId, importance: PreferenceImportance) => void;
  unwantedIngredients: string;
  onUnwantedChange: (text: string) => void;
}) {
  return <div className="product-preferences">
    <p className="fine-print">Important and very important preferences highlight matches in product details. Mandatory preferences filter out products without a verified match in Open Food Facts. Results keep Open Food Facts order.</p>
    {PREFERENCE_GROUPS.map(group => <section key={group.id}>
      <h3>{group.label}</h3>
      {group.id === "allergens" && <p className="fine-print">For an allergy, choose Mandatory. Allergen data may be missing, incomplete, incorrect, or out of date. Always check the actual packaging.</p>}
      {group.id === "ingredients_analysis" && <p className="fine-print">Ingredient analysis may be inaccurate or incomplete. Always check the product yourself.</p>}
      {group.attributes.map(attribute => <div key={attribute.id}>
        <div className="preference-row">
          <label htmlFor={`preference-${attribute.id}`}>{attribute.label}</label>
          <select id={`preference-${attribute.id}`} value={value[attribute.id] ?? "not_important"}
            onChange={e => onChange(attribute.id, e.target.value as PreferenceImportance)}>
            {PREFERENCE_IMPORTANCE.map(importance => <option key={importance} value={importance}>{IMPORTANCE_LABELS[importance]}</option>)}
          </select>
        </div>
        {attribute.id === "unwanted_ingredients" && <>
          <label className="field-label" htmlFor="unwanted-ingredients">Ingredients you cannot or do not want to eat</label>
          <textarea id="unwanted-ingredients" className="text-input" rows={2} maxLength={1600}
            placeholder="e.g. garlic, onion, gelatin" value={unwantedIngredients} onChange={e => onUnwantedChange(e.target.value)} />
          <p className="fine-print">Separate ingredients with commas. Ingredient matching uses Open Food Facts ingredient tags and analysis.</p>
        </>}
      </div>)}
      {group.id === "labels" && <p className="fine-print">Organic farming supports ecological sustainability and biodiversity. Fair trade supports producers in developing countries.</p>}
    </section>)}
  </div>;
}
