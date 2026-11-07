import { redirect } from 'next/navigation';

/** Old link: seller onboarding now lives at /sell. */
export default function SellerAccessPage(): never {
  redirect('/sell');
}
