import Stripe from "stripe";

let cached: Stripe | null = null;

// Constructed lazily (on first real use inside a request) rather than at
// module load — `new Stripe("")` throws immediately, which would crash
// build-time page-data collection for any page that imports this module
// before STRIPE_SECRET_KEY is configured.
export function getStripe(): Stripe {
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
  }
  return cached;
}
