/** Client-safe limits for the host-a-workshop form, shared with the server validation. */
export const MAX_REQUEST_IMAGES = 3;

/**
 * What the visitor sees when the form's request fails. Problems they can fix (a bad phone number, too many requests) keep the server's
 * specific message. Anything they cannot fix (server error, network down, unreadable answer) tells them to mail us instead.
 */
export function submitErrorMessage(status: number, serverMessage: unknown, contactEmail: string): string {
  if (status >= 400 && status < 500 && typeof serverMessage === 'string' && serverMessage) return serverMessage;
  return `Something went wrong. Please mail us at ${contactEmail}.`;
}

