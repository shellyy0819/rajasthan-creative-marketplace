// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { FairNotesAdmin } from '@/components/FairNotesAdmin';
import type { FairNote } from '@/lib/fair-notes';

const note = (id: number, o: Partial<FairNote> = {}): FairNote => ({ id, code: 'ABC234', stall: 'Bandhej Boutique', text: `Note ${id}`, rating: 4, source: 'sample', createdAt: '2026-11-12T10:00:00.000Z', ...o });
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('confirm', vi.fn(() => true)); window.confirm = vi.fn(() => true); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('FairNotesAdmin', () => {
  it('says so when there are no notes', () => {
    render(<FairNotesAdmin initial={[]} />);
    expect(screen.getByText(/no notes yet/i)).toBeTruthy();
  });
  it('lists notes with rating, stall, visitor code and what the fair showed, and averages the ratings', () => {
    render(<FairNotesAdmin initial={[note(1, { rating: 5 }), note(2, { rating: 3, code: 'XYZ789', source: 'real' }), note(3, { rating: 0 })]} />);
    expect(screen.getByText(/3 notes, average rating 4\.0 out of 5 from 2/)).toBeTruthy();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('XYZ-789')).toBeTruthy(); expect(within(rows[1]).getByText('Live sellers')).toBeTruthy(); expect(within(rows[0]).getByText('Sample makers')).toBeTruthy();
    expect(within(rows[2]).getByLabelText('No rating')).toBeTruthy(); expect(within(rows[0]).getByLabelText('5 out of 5')).toBeTruthy();
  });
  it('deletes a note after confirming, and shows it gone', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => null });
    render(<FairNotesAdmin initial={[note(1), note(2)]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete note from ABC234' })[0]);
    await waitFor(() => expect(screen.queryByText('Note 1')).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/fair/notes/1', { method: 'DELETE' });
    expect(screen.getByText('Note 2')).toBeTruthy();
    expect(await screen.findByText('Note deleted.')).toBeTruthy();
  });
  it('keeps the note when you change your mind', () => {
    window.confirm = vi.fn(() => false);
    render(<FairNotesAdmin initial={[note(1)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete note from ABC234' }));
    expect(fetchMock).not.toHaveBeenCalled(); expect(screen.getByText('Note 1')).toBeTruthy();
  });
  it('says what went wrong and keeps the note', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Note not found.' }) });
    render(<FairNotesAdmin initial={[note(1)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete note from ABC234' }));
    expect(await screen.findByText('Note not found.')).toBeTruthy();
    expect(screen.getByText('Note 1')).toBeTruthy();
  });
});
