// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { OnboardingDone } from '@/components/onboarding/OnboardingDone';
import { readCss } from './helpers/css';

afterEach(cleanup);

describe('OnboardingDone brand name', () => {
  it('shows the brand name highlighted inside the lead sentence', () => {
    const { container } = render(<OnboardingDone name="shelly" brand="shauk and stuff" postsUrl="/dashboard/posts" postsUrlNew="/dashboard/posts?new=1" />);
    const brand = container.querySelector('.onboard-lead strong.onboard-brand');
    expect(brand?.textContent).toBe('shauk and stuff');
    expect(container.querySelector('.onboard-lead')?.textContent).toBe('Your seller profile for shauk and stuff is ready. Here is what happens next.');
  });
  it('is styled with tokens (bold, ink colour, accent underline), no hard-coded colour', () => {
    const rule = readCss().match(/\.onboard-brand\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('font-weight:700');
    expect(rule).toContain('color:var(--ink)');
    expect(rule).toContain('text-decoration-color:var(--orange)');
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
