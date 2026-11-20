import { describe, expect, it } from 'vitest';
import { INSTAGRAM_URL, facebookUrl, mailtoUrl, shareMessage, shareTitle, shareUrl, smsUrl, whatsappUrl } from '@/lib/share';

describe('shareUrl: the address that is shared', () => {
  it('uses the origin of the page it is shared from, so any domain or subdomain shares its own address', () => {
    expect(shareUrl('https://craftofy.online', '/products/blue-vase-p21')).toBe('https://craftofy.online/products/blue-vase-p21');
    expect(shareUrl('https://www.craftofy.online', '/products/blue-vase-p21')).toBe('https://www.craftofy.online/products/blue-vase-p21');
    expect(shareUrl('https://shop.example.co.in', '/workshops/clay-w3')).toBe('https://shop.example.co.in/workshops/clay-w3');
    expect(shareUrl('http://localhost:3000', '/artists/meera-1')).toBe('http://localhost:3000/artists/meera-1');
  });
  it('tolerates a trailing slash on the origin and keeps no query or fragment from the path (filters, city, old utm values)', () => {
    expect(shareUrl('https://craftofy.online/', '/categories/pottery?page=2&utm_source=x&city=jaipur#top')).toBe('https://craftofy.online/categories/pottery');
  });
  it('Copy link adds nothing; WhatsApp, Messages, Email, Instagram, Facebook and the phone share sheet add utm_source and utm_medium=share', () => {
    const u = (c?: Parameters<typeof shareUrl>[2]) => shareUrl('https://craftofy.online', '/products/p1', c);
    expect(u('copy_link')).toBe('https://craftofy.online/products/p1');
    expect(u()).toBe('https://craftofy.online/products/p1');
    for (const c of ['whatsapp', 'instagram', 'facebook', 'sms', 'email', 'native'] as const) expect(u(c)).toBe(`https://craftofy.online/products/p1?utm_source=${c}&utm_medium=share`);
  });
  it('rejects a path that is not an address on the site, and an origin that is not http(s)', () => {
    expect(() => shareUrl('https://craftofy.online', 'products/p1')).toThrow();
    expect(() => shareUrl('https://craftofy.online', '//evil.example/x')).toThrow();
    expect(() => shareUrl('javascript:alert(1)', '/p')).toThrow();
    expect(() => shareUrl('', '/p')).toThrow();
  });
});

describe('what is written next to the link', () => {
  it('names the thing and, when known, who makes or hosts it; it never claims "handmade"', () => {
    expect(shareMessage('product', 'Blue Pottery Vase', 'Meera Studio')).toBe('Take a look at Blue Pottery Vase by Meera Studio on Craftofy:');
    expect(shareMessage('product', 'Blue Pottery Vase')).toBe('Take a look at Blue Pottery Vase on Craftofy:');
    expect(shareMessage('workshop', 'Clay Basics', 'Rina')).toBe('Take a look at Clay Basics with Rina on Craftofy:');
    expect(shareMessage('artist', 'Meera Studio')).toBe('Meet Meera Studio on Craftofy:');
    expect(shareMessage('category', 'Pottery')).toBe('Browse Pottery on Craftofy:');
    for (const k of ['product', 'workshop', 'artist', 'category'] as const) expect(shareMessage(k, 'X', 'Y')).not.toMatch(/handmade/i);
  });
  it('has a heading for each kind of page', () => {
    expect(shareTitle('product')).toBe('Share this find');
    expect(shareTitle('workshop')).toBe('Share this workshop');
    expect(shareTitle('artist')).toBe('Share this maker');
    expect(shareTitle('category')).toBe('Share this category');
  });
});

describe('the channels', () => {
  it('WhatsApp opens a chat with the message and link already filled in, escaped', () => {
    const url = whatsappUrl('Take a look at Chai & Co:', 'https://craftofy.online/products/p1?utm_source=whatsapp&utm_medium=share');
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe('Take a look at Chai & Co: https://craftofy.online/products/p1?utm_source=whatsapp&utm_medium=share');
    expect(url).not.toContain('&utm');   // the ampersands of the link are escaped, not read as part of wa.me's own query
  });
  it('Facebook gets the link only (it builds the card from the page)', () => {
    const link = 'https://craftofy.online/products/p1?utm_source=facebook&utm_medium=share';
    expect(facebookUrl(link)).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`);
  });
  it('Instagram has no share address, so it opens instagram.com after the message is copied', () => {
    expect(INSTAGRAM_URL).toBe('https://www.instagram.com/');
  });
});

describe('Messages and Email', () => {
  it('Messages opens a text with the message and link filled in (the form that works on both iPhone and Android)', () => {
    const url = smsUrl('Take a look at Chai & Co:', 'https://craftofy.online/products/p1?utm_source=sms&utm_medium=share');
    expect(url.startsWith('sms:?&body=')).toBe(true);
    expect(decodeURIComponent(url.slice('sms:?&body='.length))).toBe('Take a look at Chai & Co: https://craftofy.online/products/p1?utm_source=sms&utm_medium=share');
  });
  it('Email opens a draft with the product as the subject, and the message and link in the body', () => {
    const url = mailtoUrl('Blue Pottery Vase', 'Take a look at Blue Pottery Vase on Craftofy:', 'https://craftofy.online/products/p1?utm_source=email&utm_medium=share');
    expect(url.startsWith('mailto:?subject=Blue%20Pottery%20Vase&body=')).toBe(true);
    expect(decodeURIComponent(url.split('&body=')[1])).toBe('Take a look at Blue Pottery Vase on Craftofy:\n\nhttps://craftofy.online/products/p1?utm_source=email&utm_medium=share');
  });
});

