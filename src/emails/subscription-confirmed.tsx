import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const PLAN_LABEL: Record<string, string> = { pro: "Pro", business: "Business" };
const PLAN_PERKS: Record<string, string[]> = {
  pro: ["Unlimited tools and AI actions", "Files up to 500 MB", "No daily task limit"],
  business: ["Everything in Pro, per seat", "Team member management", "Priority support"],
};

export function SubscriptionConfirmedEmail({ plan }: { plan: "pro" | "business" }) {
  const label = PLAN_LABEL[plan] ?? "Pro";
  const perks = PLAN_PERKS[plan] ?? PLAN_PERKS.pro;

  return (
    <EmailLayout preview={`You're now on ${label}`}>
      <Text style={emailStyles.heading}>You&apos;re now on {label} 🎉</Text>
      <Text style={emailStyles.text}>Your Claira Slate subscription is active. Here&apos;s what just unlocked:</Text>
      {perks.map((perk) => (
        <Text key={perk} style={{ ...emailStyles.text, margin: "0 0 6px" }}>
          ✓ {perk}
        </Text>
      ))}
      <Button href={`${SITE_URL}/app`} style={{ ...emailStyles.button, marginTop: 16 }}>
        Go to dashboard &rarr;
      </Button>
    </EmailLayout>
  );
}

export default SubscriptionConfirmedEmail;
