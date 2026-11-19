import { describe, expect, it } from 'vitest';
import { fieldErrorFromMessage } from '@/lib/field-errors';
import { JOIN_LINK_HINT, validJoinLink } from '@/lib/join-link';

describe('validJoinLink', () => {
  it('accepts https links with a real host, and refuses the rest', () => {
    for (const ok of ['https://zoom.us/j/123', 'https://meet.google.com/abc-defg-hij', 'https://us02web.zoom.us/j/1?pwd=x']) expect(validJoinLink(ok), ok).toBe(true);
    for (const bad of ['https://zoom', 'http://zoom.us/j/1', 'zoom.us/j/1', 'https://u:p@zoom.us/j/1', 'javascript:alert(1)', 'https://' + 'a'.repeat(500) + '.com']) expect(validJoinLink(bad), bad).toBe(false);
    expect(JOIN_LINK_HINT).toMatch(/https/);
  });
});

describe('fieldErrorFromMessage', () => {
  it('points a server message at the field it is about, with a friendly name', () => {
    expect(fieldErrorFromMessage('joinLink must be a full https link, for example https://zoom.us/j/123.')).toEqual({ name: 'joinLink', text: 'Meeting link must be a full https link, for example https://zoom.us/j/123.' });
    expect(fieldErrorFromMessage('phone must be a valid Indian mobile number, e.g. 9989898999.')).toMatchObject({ name: 'phone', text: expect.stringMatching(/^Phone number must be/) });
    expect(fieldErrorFromMessage('email must be a valid email address.')).toMatchObject({ name: 'email' });
    expect(fieldErrorFromMessage('whatsapp is invalid. Enter a valid Indian mobile number.')).toMatchObject({ name: 'whatsapp', text: expect.stringMatching(/^WhatsApp number is invalid/) });
    expect(fieldErrorFromMessage('freeTrialDays must be an integer between 1 and 365.')).toMatchObject({ name: 'freeTrialDays' });
    expect(fieldErrorFromMessage('endsOn cannot be before startDate.')).toMatchObject({ name: 'endsOn', text: 'End date cannot be before the start date.' });
    expect(fieldErrorFromMessage('priceRupees must be an integer between 1 and 1000000.')).toMatchObject({ name: 'priceRupees' });
    expect(fieldErrorFromMessage('website must be a web address like example.com.')).toMatchObject({ name: 'website' });
  });
  it('schedule, languages and prices messages land on their group', () => {
    expect(fieldErrorFromMessage('schedule needs class days, a time (HH:MM) and a duration of 15 to 480 minutes.')).toMatchObject({ name: 'days' });
    expect(fieldErrorFromMessage('languages must each be 2 to 30 characters.')).toMatchObject({ name: 'languages' });
    expect(fieldErrorFromMessage('prices: each plan needs a name of up to 30 characters.')).toMatchObject({ name: 'prices' });
  });
  it('a message that names no field stays unmapped (the banner shows it)', () => {
    expect(fieldErrorFromMessage('Too many requests.')).toBeNull();
    expect(fieldErrorFromMessage('Something went wrong. Please mail us at x@y.z.')).toBeNull();
    expect(fieldErrorFromMessage('One or more photos are not allowed.')).toBeNull();
  });
});
