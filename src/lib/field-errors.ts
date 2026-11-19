/** Friendly names for the fields the server's messages start with (the server says "joinLink must be ..."). */
const LABELS: Record<string, string> = {
  joinLink: 'Meeting link', phone: 'Phone number', email: 'Email', whatsapp: 'WhatsApp number', instagram: 'Instagram', website: 'Website',
  hostName: 'Host name', contactName: 'Your name', title: 'Title', description: 'Description', venue: 'Venue', seats: 'Seats',
  startDate: 'Start date', endDate: 'End date', endsOn: 'End date', startTime: 'Start time', endTime: 'End time', priceRupees: 'Price',
  platform: 'Online platform', languages: 'Languages', level: 'Level', experience: 'Experience', certifications: 'Certifications',
  freeTrialDays: 'Free trial length', notes: 'Notes', kind: 'Type', topicId: 'Topic', contactPhone: 'Contact phone', contactEmail: 'Contact email',
};
/** Which input (or group) a server field belongs to. */
const INPUT: Record<string, string> = { schedule: 'days', prices: 'prices', city: 'cityRef', cityRef: 'cityRef', cityId: 'cityRef' };

/** "joinLink must be ..." becomes { name: 'joinLink', text: 'Meeting link must be ...' }; a message about no field is null. */
export function fieldErrorFromMessage(message: string): { name: string; text: string } | null {
  if (message === 'endsOn cannot be before startDate.') return { name: 'endsOn', text: 'End date cannot be before the start date.' };
  if (message === 'endDate cannot be before startDate.') return { name: 'endDate', text: 'End date cannot be before the start date.' };
  const m = /^([A-Za-z]+)(?=[\s:])/.exec(message);
  if (!m) return null;
  const key = m[1];
  if (!(key in LABELS) && !(key in INPUT)) return null;
  const name = INPUT[key] ?? key;
  const text = LABELS[key] ? `${LABELS[key]}${message.slice(key.length)}` : message.replace(/^\w+:?\s*/, c => c.charAt(0).toUpperCase() + c.slice(1));
  return { name, text };
}
