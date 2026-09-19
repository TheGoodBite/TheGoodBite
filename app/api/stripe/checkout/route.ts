import { z } from "zod";
import { ApiError, handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { getPriceId, getSiteUrl, getStripe } from "@/lib/stripe";
import { getCurrentProfile, requireAdminSupabase } from "@/lib/supabase";

const schema = z.object({
  interval: z.enum(["monthly", "yearly"])
});

export async function POST(request: Request) {
  try {
    const { user } = await requireUserAndEntitlement(request);
    const body = schema.parse(await request.json());
    const stripe = getStripe();
    if (!stripe) throw new ApiError("Stripe is not configured.", 500);

    const priceId = getPriceId(body.interval);
    if (!priceId) throw new ApiError("Stripe price ID is not configured.", 500);

    const supabase = requireAdminSupabase();
    const profile = await getCurrentProfile(user);
    let customerId = profile.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${getSiteUrl()}?checkout=success`,
      cancel_url: `${getSiteUrl()}?checkout=cancelled`,
      metadata: { supabase_user_id: user.id }
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
