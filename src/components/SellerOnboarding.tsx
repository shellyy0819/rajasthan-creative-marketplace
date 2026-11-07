// PLACEHOLDER: replaced by the real onboarding wizard in Tasks 6 to 8 of the seller-onboarding plan.
export type SellerOnboardingProps = { initialName: string; initialEmail: string; postsUrl: string; postsUrlNew: string };

export function SellerOnboarding({ initialName, initialEmail }: SellerOnboardingProps) {
  return (
    <main>
      <h1>Set up your seller profile</h1>
      <p>{initialName} ({initialEmail})</p>
    </main>
  );
}
