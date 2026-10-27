// Only known, non-sensitive categories reach the UI; provider messages may
// contain email addresses or other diagnostics and must never be reflected.
export function emailError(error: { code?: string; status?: number }) {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "The email sending limit has been reached. Wait for the limit to reset before requesting another link. The app administrator can configure custom SMTP for higher limits.";
    case "over_request_rate_limit":
      return "Too many sign-in requests. Pause before requesting another link.";
    case "email_address_not_authorized":
      return "The current email service cannot send to this address. The app administrator needs to configure custom SMTP.";
    case "email_provider_disabled":
      return "Email sign-in is disabled for this project. The app administrator needs to enable the email provider.";
    case "signup_disabled":
      return "New account registration is disabled for this project.";
    case "email_address_invalid":
      return "The email provider rejected this address. Check the address and try again.";
    default:
      if (error.status === 429)
        return "Too many authentication requests. Wait for the limit to reset before retrying.";
      return "The sign-in email could not be sent. Check Supabase Auth logs for the error code before retrying.";
  }
}
