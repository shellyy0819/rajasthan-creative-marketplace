import './RemovableChip.css';

/**
 * A pill with a ✕ that removes what it names: selected languages in the host form, the filters in use on the shop and workshop lists.
 * The whole chip is one button, named "Remove <label>" for screen readers.
 */
export function RemovableChip({ label, onRemove, className = '' }: { label: string; onRemove: () => void; className?: string }) {
  return <button type="button" className={`chip-x${className ? ` ${className}` : ''}`} aria-label={`Remove ${label}`} onClick={onRemove}>{label} <span aria-hidden="true">✕</span></button>;
}
