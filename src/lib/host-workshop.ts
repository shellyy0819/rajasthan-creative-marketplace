import { contactEmail } from './site';

// Pre-filled mail for hosts: fill in the blanks, or delete it all and write your own.
const HOST_BODY = `Hi Craftofy team,

I would like to host a workshop or pop-up on Craftofy. My details are below.

Host / studio / cafe name:
Your name:
Phone:
Email:
City:
Venue and address:

Workshop title:
Type (workshop / meetup / pop-up):
What participants will do or make:
Preferred date and time:
Duration:
Seats available:
Free or paid (if paid, price per person in Rs.):
Instagram / website (optional):

Anything else we should know:

Thank you!
`;

/** mailto: link with the pre-filled "host a workshop" template. */
export function hostWorkshopMailto(email: string = contactEmail()): string {
  return `mailto:${email}?subject=${encodeURIComponent('Hosting a Craftofy workshop')}&body=${encodeURIComponent(HOST_BODY)}`;
}
