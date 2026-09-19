import Stripe from "stripe";

let stripe: Stripe | null | undefined;

export function getStripe() {
  if (stripe !== undefined) return stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  stripe = key ? new Stripe(key, { apiVersion: "2025-10-29.clover" }) : null;
  return stripe;
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export function getPriceId(interval: "monthly" | "yearly") {
  return interval === "monthly"
    ? process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
    : process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID;
}
