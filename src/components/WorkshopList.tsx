import type { ReactNode } from 'react';
import type { Workshop } from '@/lib/types';
import { WorkshopCard } from './WorkshopCard';

/** `loading`: results are on their way, so an empty list is not yet "nothing found" and the message is held back (the page shows its loader instead). */
export function WorkshopList({ workshops, emptyMessage = 'No workshops found. Try a different city or filter.', emptyAction, loading = false }: { workshops: Workshop[]; emptyMessage?: string; emptyAction?: ReactNode; loading?: boolean }) {
  if (!workshops.length && loading) return <div className="workshop-list" />;
  if (!workshops.length) return <div className="workshop-list"><div className="empty"><p>{emptyMessage}</p>{emptyAction}</div></div>;
  return <div className="workshop-list">{workshops.map(w => <WorkshopCard key={w.id} w={w} />)}</div>;
}
