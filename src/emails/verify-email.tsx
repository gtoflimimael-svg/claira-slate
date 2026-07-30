import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

export function VerifyEmail({ verifyUrl }: { verifyUrl: string }) {
  return (
    <EmailLayout preview="Verify your email for Claira Slate">
      <Text style={emailStyles.heading}>Verify your email</Text>
      <Text style={emailStyles.text}>
        Click below to confirm this is your email address and finish setting up your Claira Slate account.
      </Text>
      <Button href={verifyUrl} style={emailStyles.button}>
        Verify email &rarr;
      </Button>
      <Text style={emailStyles.notice}>This link expires in 24 hours. If you didn&apos;t create this account, you can ignore this email.</Text>
    </EmailLayout>
  );
}

export default VerifyEmail;
