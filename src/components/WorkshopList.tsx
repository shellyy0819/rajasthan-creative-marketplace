import type { Workshop } from '@/lib/types';
import { WorkshopCard } from './WorkshopCard';

export function WorkshopList({ workshops }: { workshops: Workshop[] }) {
  if (!workshops.length) return <div className="workshop-list"><div className="empty">No workshops found. Try a different city or filter.</div></div>;
  return <div className="workshop-list">{workshops.map(w => <WorkshopCard key={w.id} w={w} />)}</div>;
}
