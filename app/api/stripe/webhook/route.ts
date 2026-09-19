import { headers } from "next/headers";
import type Stripe from "stripe";
import { handleRouteError } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { requireAdminSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !webhookSecret) return Response.json({ error: "Stripe webhook is not configured." }, { status: 500 });

    const body = await request.text();
    const signature = (await headers()).get("stripe-signature");
    if (!signature) return Response.json({ error: "Missing Stripe signature." }, { status: 400 });

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    await handleStripeEvent(event);

    return Response.json({ received: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function handleStripeEvent(event: Stripe.Event) {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return;
  }

  const supabase = requireAdminSupabase();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.supabase_user_id;
    if (!userId) return;

    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId) return;

    const stripe = getStripe();
    if (!stripe) return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await supabase
      .from("profiles")
      .update({
        stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
        subscription_status: subscription.status,
        subscription_price_id: subscription.items.data[0]?.price.id ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);
    return;
  }

  const subscription = event.data.object as Stripe.Subscription;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  await supabase
    .from("profiles")
    .update({
      subscription_status: subscription.status,
      subscription_price_id: subscription.items.data[0]?.price.id ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("stripe_customer_id", customerId);
}
