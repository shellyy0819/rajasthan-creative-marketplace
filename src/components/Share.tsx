import { auth } from '@/auth';
import { canSeeShare, shareVisibility } from '@/lib/share-settings';
import { ShareButton, type ShareProps } from './ShareButton';

/**
 * The Share button for a page, shown only to the people the admin chose on the Settings page (admins only until they switch it to everyone).
 * Decided on the server, so a visitor who may not see it never receives the button or its code in the page.
 * Pages call it as a function (`const share = await Share({...})`) and hand the result to their layout, which keeps the layout components synchronous.
 * It can never break the page it sits on: if the setting or the session cannot be read, the button is simply not shown.
 */
export async function Share(props: ShareProps) {
  try {
    const visibility = await shareVisibility();
    const session = visibility === 'everyone' ? null : await auth();   // nobody's session is needed once everyone may see it
    if (!canSeeShare(visibility, session)) return null;
    return <ShareButton {...props} />;
  } catch {
    return null;
  }
}
