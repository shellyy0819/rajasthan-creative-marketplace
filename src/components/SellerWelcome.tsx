// PLACEHOLDER: replaced by the real welcome page in Tasks 6 to 8 of the seller-onboarding plan.
export function SellerWelcome() {
  return (
    <main>
      <h1>Sell on Craftofy</h1>
      <a href={`/api/auth/signin?callbackUrl=${encodeURIComponent('/sell')}`}>Sign in with Google</a>
    </main>
  );
}
