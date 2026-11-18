import { CafeScene } from './CafeScene';
import { HostWorkshopButton } from './HostWorkshopButton';
import { contactEmail } from '@/lib/site';
import './WorkshopsEmptyState.css';

/** Shown on /workshops while no workshop exists at all (not when a filter finds nothing): what is coming and how a studio or café can host one. */
export function WorkshopsEmptyState() {
  return (
    <div className="ws-empty-wrap">
    <section className="ws-empty" aria-labelledby="ws-empty-h">
      <h2 id="ws-empty-h">The first workshops are coming</h2>
      <p>No workshop is scheduled yet. Studios, cafés and makers across India can host hands-on workshops, creative meetups and pop-ups here.</p>
      <ol className="ws-empty-steps">
        <li>Tell us about your workshop: what happens, when and where.</li>
        <li>We check the details and write to you to confirm.</li>
        <li>Your workshop is listed here for people to find and join.</li>
      </ol>
      <HostWorkshopButton contactEmail={contactEmail()} />
    </section>
    <div className="ws-empty-art"><CafeScene /></div>
    </div>
  );
}
