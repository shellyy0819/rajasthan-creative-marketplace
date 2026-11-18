import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkshopRequestsAdmin } from '@/components/WorkshopRequestsAdmin';
import type { WorkshopRequest } from '@/lib/workshop-requests';

const base = { id: '1', hostName: 'Asha Yoga', contactName: 'Asha', phone: '+919989898999', email: 'a@b.co', city: '', venue: '', title: 'Morning Flow', kind: 'class', mode: 'online', topic: 'Yoga',
  description: 'Gentle hatha yoga.', startDate: '2027-01-05', endDate: '2027-01-05', status: 'received', emailVerified: true, images: [], priceType: 'PAID', pricePaise: 50000, createdAt: '2026-11-18T10:00:00Z',
  platform: 'Zoom', schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 }, languages: ['Hindi', 'English'], level: 'beginner', experience: '8 years', certifications: 'RYT 500',
  freeTrial: true, whatsapp: '+919989898999', prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }, { label: 'Monthly', amountPaise: 150000, sessions: 12 }] } as unknown as WorkshopRequest;

describe('requests table', () => {
  it('shows an online class with its topic, platform, schedule, plans and details, and no empty "venue, city"', () => {
    const h = renderToStaticMarkup(<WorkshopRequestsAdmin requests={[base]} />);
    for (const s of ['Online class', 'Yoga', 'Online · Zoom', 'Mon, Wed, Fri at 7:00 am, 60 min', 'Per session: ₹500 (1 session)', 'Monthly: ₹1,500 (12 sessions)', 'Hindi, English', 'beginner', '8 years', 'RYT 500', 'Free trial', 'wa.me/919989898999']) expect(h).toContain(s);
    expect(h).not.toContain('>, <');
  });
  it('still shows an in-person event as before', () => {
    const r = { ...base, kind: 'workshop', mode: 'in_person', city: 'Jaipur, Rajasthan', venue: 'Studio', seats: 10, schedule: undefined, platform: undefined, prices: [], languages: [], freeTrial: false } as unknown as WorkshopRequest;
    const h = renderToStaticMarkup(<WorkshopRequestsAdmin requests={[r]} />);
    expect(h).toContain('Studio, Jaipur, Rajasthan');
    expect(h).toContain('10 · Rs. 500');
  });
  it('each request links to Create listing, or says which listing it became', () => {
    const open = renderToStaticMarkup(<WorkshopRequestsAdmin requests={[base]} />);
    expect(open).toContain('href="/dashboard/workshops?from=1"');
    const listed = renderToStaticMarkup(<WorkshopRequestsAdmin requests={[{ ...base, status: 'listed', listedWorkshopId: 'w12' } as WorkshopRequest]} />);
    expect(listed).toContain('Listed as w12');
    expect(listed).not.toContain('Create listing');
  });
});
