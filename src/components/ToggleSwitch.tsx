import type { ReactNode } from 'react';

// On/off switch. The whole control is one button with role="switch", so the
// label (children) is its accessible name and the track is decoration only.
export function ToggleSwitch({ checked, onToggle, className = '', children }: {
  checked: boolean;
  onToggle: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`button toggle-switch ${className}`.trim()} onClick={onToggle}>
      {children}
      <span className="toggle-switch-track" aria-hidden="true"><span className="toggle-switch-knob" /></span>
    </button>
  );
}
