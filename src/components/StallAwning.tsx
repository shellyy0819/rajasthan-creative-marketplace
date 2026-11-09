import { useId } from 'react';

/** The striped stall awning from the home illustration (HeroStall), drawn to repeat across any width. Decorative. */
export function StallAwning({ className = 'stall-awning' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} width="100%" height="84" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`awning-${id}`} width="116" height="84" patternUnits="userSpaceOnUse">
          <path d="M0 22H58V55a29 29 0 0 1-58 0Z" className="st-f-terra" />
          <path d="M58 22H116V55a29 29 0 0 1-58 0Z" className="st-f-mustard" />
        </pattern>
      </defs>
      <rect width="100%" height="84" fill={`url(#awning-${id})`} />
      <rect width="100%" height="22" className="st-f-green" />
      <rect y="21" width="100%" height="2" className="st-f-terrad" opacity=".5" />
    </svg>
  );
}
