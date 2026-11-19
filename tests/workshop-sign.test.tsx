// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { GET as getRoute, PUT as putRoute } from '@/app/api/admin/workshop-sign/route';
import { CafeScene } from '@/components/CafeScene';
import { SignTextAdmin } from '@/components/SignTextAdmin';
import { boardLines, DEFAULT_SIGN, getSignText, saveSignText, signFor } from '@/lib/workshop-sign';
import { resetTestDb } from './helpers/testdb';

const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
const req = (body: unknown) => new Request('http://x/api/x', { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('board text rules', () => {
  it('picks the text for none, one and several live workshops, with {n} replaced and capped at 99+', () => {
    expect(signFor(DEFAULT_SIGN, 0)).toBe('Stay Tuned!');
    expect(signFor(DEFAULT_SIGN, 1)).toBe('Workshop live');
    expect(signFor(DEFAULT_SIGN, 10)).toBe('10 workshops live');
    expect(signFor(DEFAULT_SIGN, 250)).toBe('99+ workshops live');
    expect(signFor({ ...DEFAULT_SIGN, many: 'Now on: {n}' }, 3)).toBe('Now on: 3');
  });
  it('fits a long text on at most two lines, breaking at the last space', () => {
    expect(boardLines('Stay Tuned!')).toEqual(['Stay Tuned!']);
    expect(boardLines('Workshop live')).toEqual(['Workshop', 'live']);
    expect(boardLines('10 workshops live')).toEqual(['10 workshops', 'live']);
    expect(boardLines('Coming')).toEqual(['Coming']);
  });
});

describe('saving the board text', () => {
  beforeEach(async () => { await resetTestDb(); });
  it('starts with the defaults, then returns what an admin saved', async () => {
    expect(await getSignText()).toEqual(DEFAULT_SIGN);
    await saveSignText({ idle: 'Coming soon', one: 'On today', many: '{n} on today' }, 'root@x.co');
    expect(await getSignText()).toEqual({ idle: 'Coming soon', one: 'On today', many: '{n} on today' });
  });
  it('refuses empty, too long, multi-line texts, and a "many" text without {n}', async () => {
    const ok = { idle: 'Soon', one: 'On', many: '{n} on' };
    for (const bad of [{ idle: '' }, { idle: 'x'.repeat(21) }, { one: 'a\nb' }, { many: 'Several workshops' }]) {
      await expect(saveSignText({ ...ok, ...bad }, 'root@x.co')).rejects.toMatchObject({ status: 400 });
    }
    expect(await getSignText()).toEqual(DEFAULT_SIGN);
  });
  it('the routes are admin only', async () => {
    authMock.mockReset(); authMock.mockResolvedValue(null);
    expect((await getRoute()).status).toBe(401);
    expect((await putRoute(req(DEFAULT_SIGN))).status).toBe(401);
    authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
    expect((await putRoute(req(DEFAULT_SIGN))).status).toBe(403);
    asAdmin();
    expect((await putRoute(req({ idle: 'Hello!', one: 'One live', many: '{n} live' }))).status).toBe(200);
    expect(await (await getRoute()).json()).toEqual({ idle: 'Hello!', one: 'One live', many: '{n} live' });
  });
});

describe('the sign on the café board', () => {
  it('uses the admin text when given, and the defaults otherwise', () => {
    const custom = { idle: 'Coming soon', one: 'On today', many: '{n} on today' };
    expect(renderToStaticMarkup(<CafeScene signText={custom} />)).toContain('>Coming soon<');
    expect(renderToStaticMarkup(<CafeScene signText={custom} liveCount={1} />)).toContain('>On today<');
    expect(renderToStaticMarkup(<CafeScene signText={custom} liveCount={4} />)).toContain('>4 on today<');
    expect(renderToStaticMarkup(<CafeScene />)).toContain('>Stay Tuned!<');
  });
  it('puts the text in the picture description too', () => {
    expect(renderToStaticMarkup(<CafeScene signText={{ idle: 'Coming soon', one: 'x', many: '{n}' }} />)).toContain('says Coming soon');
  });
});

describe('admin panel on the Workshops tab', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('shows the three texts, saves them with PUT, and says it worked', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ idle: 'Soon!', one: 'On now', many: '{n} on now' }) });
    render(<SignTextAdmin initial={DEFAULT_SIGN} />);
    expect((screen.getByLabelText(/no workshop is live today/i) as HTMLInputElement).value).toBe('Stay Tuned!');
    fireEvent.change(screen.getByLabelText(/no workshop is live today/i), { target: { value: 'Soon!' } });
    fireEvent.change(screen.getByLabelText(/one workshop is live/i), { target: { value: 'On now' } });
    fireEvent.change(screen.getByLabelText(/several workshops are live/i), { target: { value: '{n} on now' } });
    fireEvent.click(screen.getByRole('button', { name: /save board text/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/workshop-sign', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ idle: 'Soon!', one: 'On now', many: '{n} on now' }) })));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/saved/i));
  });
  it('shows the server message when it refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'many must contain {n}, the number of live workshops.' }) });
    render(<SignTextAdmin initial={DEFAULT_SIGN} />);
    fireEvent.click(screen.getByRole('button', { name: /save board text/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/must contain/));
  });
  it('previews the board text with the number filled in', () => {
    render(<SignTextAdmin initial={DEFAULT_SIGN} />);
    const preview = screen.getByTestId('sign-preview').textContent ?? '';
    expect(preview).toMatch(/Stay Tuned!/);
    expect(preview).toMatch(/2 workshops live/);
  });
});
