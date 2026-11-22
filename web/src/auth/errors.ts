/** Turn a raw Supabase auth error message into a message fit for the user. */
export function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address first. Check your inbox for the confirmation link.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('security purposes')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return message;
}
