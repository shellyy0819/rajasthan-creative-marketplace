export type RequestDone = { name: string; email: string; from: string; to: string; confirmed: boolean; notified: boolean };

const STEPS = (email: string) => [
  'We read through your workshop details.',
  `We write to you on ${email} to say hello and confirm.`,
  'Together we get your workshop listed on Workshops & pop-ups.',
];

/** The warm "we have your request" screen of the Host a workshop dialog: who we heard from, what we received, and what happens next. */
export function RequestReceived({ done, onClose }: { done: RequestDone; onClose: () => void }) {
  const dates = done.from === done.to ? done.from : `${done.from} to ${done.to}`;
  return (
    <div className="req-done">
      <div className="req-done-hero">
        <span className="req-done-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        </span>
        <p className="req-done-eyebrow">Request received</p>
        <h3 className="req-done-title">Thank you, {done.name}!</h3>
        <p className="req-done-lead">{done.notified ? 'Your workshop details are with us and the Craftofy team has been notified.' : 'Your workshop details are with us.'}</p>
      </div>
      <dl className="req-done-facts">
        <div>
          <dt>Dates</dt>
          <dd>{dates}</dd>
        </div>
        <div>
          <dt>We will write to</dt>
          <dd>{done.email}{done.confirmed && <span className="req-done-pill">Email confirmed</span>}</dd>
        </div>
      </dl>
      <h4 className="req-done-next">What happens next</h4>
      <ol className="req-done-steps">
        {STEPS(done.email).map(s => <li key={s}>{s}</li>)}
      </ol>
      <p className="req-done-warm">We can’t wait to see your workshop on Craftofy.</p>
      <div className="admin-actions"><button type="button" className="button primary" onClick={onClose}>Done</button></div>
    </div>
  );
}
