// One-time setup script: creates the Pro and Business Stripe products/prices
// for Claira Slate in whichever Stripe account STRIPE_SECRET_KEY points to
// (use a test-mode secret key — sk_test_...).
//
// Usage (after filling in STRIPE_SECRET_KEY in .env.local):
//   node --env-file=.env.local scripts/setup-stripe-products.mjs
//
// Safe to re-run: it looks for existing products by metadata marker before
// creating new ones, so it won't duplicate products on a second run.

import Stripe from "stripe";

async function findExistingPrice(stripe, planKey) {
  const products = await stripe.products.list({ limit: 100, active: true });
  const product = products.data.find((p) => p.metadata?.claira_slate_plan === planKey);
  if (!product) return null;

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 1 });
  return prices.data[0] ?? null;
}

async function ensurePlan(stripe, { planKey, name, unitAmount, nickname }) {
  const existing = await findExistingPrice(stripe, planKey);
  if (existing) {
    console.log(`✓ ${name} already exists — reusing price ${existing.id}`);
    return existing.id;
  }

  const product = await stripe.products.create({
    name,
    metadata: { claira_slate_plan: planKey },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: unitAmount,
    recurring: { interval: "month" },
    nickname,
  });

  console.log(`✓ Created ${name} — price ${price.id}`);
  return price.id;
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set. Fill it in .env.local first, then run:");
    console.error("  node --env-file=.env.local scripts/setup-stripe-products.mjs");
    process.exit(1);
  }
  if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    console.error("STRIPE_SECRET_KEY does not look like a test-mode key (expected sk_test_...). Refusing to run against a live key.");
    process.exit(1);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const proPriceId = await ensurePlan(stripe, {
    planKey: "pro",
    name: "Claira Slate Pro",
    unitAmount: 500, // $5.00
    nickname: "Pro monthly",
  });

  const businessPriceId = await ensurePlan(stripe, {
    planKey: "business",
    name: "Claira Slate Business",
    unitAmount: 1200, // $12.00 per seat
    nickname: "Business monthly per seat",
  });

  console.log("\nAdd these to .env.local:\n");
  console.log(`STRIPE_PRO_PRICE_ID=${proPriceId}`);
  console.log(`STRIPE_BUSINESS_PRICE_ID=${businessPriceId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
