import { RichText } from '../RichText';

/**
 * Inside the instructor (or host) card: what they say about themselves, then, set apart under a rule, their certifications as a
 * checked list. Each part has its own heading and appears only when there is data for it.
 */
export function InstructorBio({ experience, certifications, who }: { experience?: string | null; certifications?: string | null; who: 'instructor' | 'host' }) {
  if (!experience && !certifications) return null;
  return (
    <div className="cd-sub">
      {experience && (
        <section className="cd-about" aria-label={`About the ${who}`}>
          <span className="cd-label cd-sub-label">About the {who}</span>
          <RichText value={experience} />
        </section>
      )}
      {certifications && (
        <section className="cd-certs" aria-label="Certifications">
          <span className="cd-label cd-sub-label">Certifications</span>
          <RichText value={certifications} />
        </section>
      )}
    </div>
  );
}
