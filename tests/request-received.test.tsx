// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RequestReceived, type RequestDone } from '@/components/RequestReceived';

afterEach(cleanup);
const D: RequestDone = { name: 'shelly', email: 'shelly@mailinator.com', from: '25 Nov 2026', to: '26 Nov 2026', confirmed: true, notified: true };

describe('RequestReceived', () => {
  it('thanks the host by name and says the team has been told', () => {
    render(<RequestReceived done={D} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Thank you, shelly!' })).toBeTruthy();
    expect(screen.getByText(/Craftofy team has been notified/)).toBeTruthy();
    expect(screen.getByText('Request received')).toBeTruthy();
  });
  it('shows the dates (one date when from and to are the same) and the email with a confirmed pill', () => {
    const { container, rerender } = render(<RequestReceived done={D} onClose={() => {}} />);
    expect(container.querySelector('.req-done-facts')!.textContent).toContain('25 Nov 2026 to 26 Nov 2026');
    expect(container.querySelector('.req-done-facts')!.textContent).toContain('shelly@mailinator.com');
    expect(screen.getByText('Email confirmed')).toBeTruthy();
    rerender(<RequestReceived done={{ ...D, to: D.from, confirmed: false, notified: false }} onClose={() => {}} />);
    expect(container.querySelector('.req-done-facts')!.textContent).not.toContain(' to ');
    expect(screen.queryByText('Email confirmed')).toBeNull();
    expect(screen.queryByText(/has been notified/)).toBeNull();
    expect(screen.getByText('Your workshop details are with us.')).toBeTruthy();
  });
  it('explains what happens next, in three steps that name the email', () => {
    const { container } = render(<RequestReceived done={D} onClose={() => {}} />);
    const steps = [...container.querySelectorAll('.req-done-steps li')].map(li => li.textContent);
    expect(steps).toHaveLength(3);
    expect(steps[1]).toContain('shelly@mailinator.com');
  });
  it('Done closes it', () => {
    const close = vi.fn();
    render(<RequestReceived done={D} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
