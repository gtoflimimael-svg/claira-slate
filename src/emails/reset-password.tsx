import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

export function ResetPasswordEmail({ resetUrl }: { resetUrl: string }) {
  return (
    <EmailLayout preview="Reset your Claira Slate password">
      <Text style={emailStyles.heading}>Reset your password</Text>
      <Text style={emailStyles.text}>
        We received a request to reset the password on your Claira Slate account. Click below to choose a new one.
      </Text>
      <Button href={resetUrl} style={emailStyles.button}>
        Reset password &rarr;
      </Button>
      <Text style={emailStyles.notice}>This link expires in 1 hour. If you didn&apos;t request this, you can ignore this email.</Text>
    </EmailLayout>
  );
}

export default ResetPasswordEmail;
