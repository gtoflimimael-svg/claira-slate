import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { SubscriptionConfirmedEmail } from "@/emails/subscription-confirmed";
import { PaymentFailedEmail } from "@/emails/payment-failed";

// Stripe subscription statuses mapped onto our own subscriptions.status
// check constraint (active, trialing, past_due, canceled, inactive, incomplete).
function mapStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "unpaid":
      return "past_due";
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "inactive";
    default:
      return status;
  }
}

function periodEndFromSubscription(subscription: Stripe.Subscription): string | null {
  const timestamp = subscription.items.data[0]?.current_period_end;
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe is not configured yet (missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET)." }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan;
      const customerId = session.customer as string | null;
      const subscriptionId = session.subscription as string | null;

      if (!userId || !plan || !customerId) break;

      let currentPeriodEnd: string | null = null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        currentPeriodEnd = periodEndFromSubscription(subscription);
      }

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          plan,
          status: "active",
          current_period_end: currentPeriodEnd,
        },
        { onConflict: "user_id" }
      );

      const confirmationEmail = session.customer_details?.email;
      if (confirmationEmail && (plan === "pro" || plan === "business")) {
        try {
          await sendEmail({
            to: confirmationEmail,
            subject: `You're now on ${plan === "business" ? "Business" : "Pro"} 🎉`,
            react: SubscriptionConfirmedEmail({ plan }),
          });
        } catch (err) {
          console.error("Failed to send subscription-confirmed email", err);
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const plan = subscription.metadata?.plan;

      await supabase
        .from("subscriptions")
        .update({
          ...(plan ? { plan } : {}),
          status: mapStatus(subscription.status),
          current_period_end: periodEndFromSubscription(subscription),
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await supabase
        .from("subscriptions")
        .update({ plan: "free", status: "inactive" })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      await supabase.from("subscriptions").update({ status: "past_due" }).eq("stripe_customer_id", customerId);

      try {
        const failedEmail = invoice.customer_email;
        if (failedEmail) {
          await sendEmail({ to: failedEmail, subject: "Action required: payment failed", react: PaymentFailedEmail() });
        }
      } catch (err) {
        console.error("Failed to send payment-failed email", err);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
