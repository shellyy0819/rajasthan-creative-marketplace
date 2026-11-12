import type { ReactNode } from 'react';
import type { Workshop } from '@/lib/types';
import { WorkshopCard } from './WorkshopCard';

export function WorkshopList({ workshops, emptyMessage = 'No workshops found. Try a different city or filter.', emptyAction }: { workshops: Workshop[]; emptyMessage?: string; emptyAction?: ReactNode }) {
  if (!workshops.length) return <div className="workshop-list"><div className="empty"><p>{emptyMessage}</p>{emptyAction}</div></div>;
  return <div className="workshop-list">{workshops.map(w => <WorkshopCard key={w.id} w={w} />)}</div>;
}
