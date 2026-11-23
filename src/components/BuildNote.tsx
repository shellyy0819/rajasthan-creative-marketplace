import { appVersion, formatBuiltAt } from '@/lib/version';

/** One quiet line at the foot of the admin dashboard saying which commit is live, so it can be compared with git. Render for admins only. */
export function BuildNote() {
  const v = appVersion();
  return (
    <p className="admin-build" aria-label="Build version">
      {v.commit
        ? <>Version <code title={v.commit}>{v.shortCommit}</code>{v.builtAt ? <> · built {formatBuiltAt(v.builtAt)}</> : null}</>
        : <>Version unknown: this build was not told its commit.</>}
    </p>
  );
}
