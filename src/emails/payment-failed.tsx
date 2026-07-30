import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function PaymentFailedEmail() {
  return (
    <EmailLayout preview="Action required: your payment failed">
      <Text style={emailStyles.heading}>Action required: payment failed</Text>
      <Text style={emailStyles.text}>
        We couldn&apos;t process your latest payment for Claira Slate. Update your payment method to keep your plan active —
        we&apos;ll retry automatically over the next few days.
      </Text>
      <Button href={`${SITE_URL}/app/billing`} style={emailStyles.button}>
        Update payment method &rarr;
      </Button>
    </EmailLayout>
  );
}

export default PaymentFailedEmail;
