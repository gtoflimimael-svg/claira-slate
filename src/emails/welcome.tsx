import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function WelcomeEmail({ email }: { email: string }) {
  return (
    <EmailLayout preview="Your Claira Slate account is ready">
      <Text style={emailStyles.heading}>Your account is ready</Text>
      <Text style={emailStyles.text}>
        Hi {email}, welcome to Claira Slate. You now have access to 26 free PDF tools and 4 AI features — merge, compress,
        convert, summarize, translate and more, all in one place.
      </Text>
      <Button href={`${SITE_URL}/app`} style={emailStyles.button}>
        Start using Claira Slate &rarr;
      </Button>
    </EmailLayout>
  );
}

export default WelcomeEmail;
