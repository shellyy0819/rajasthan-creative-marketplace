'use client';
import { useCallback, useState } from 'react';
import { ProfileDialog } from './ProfileDialog';
import { Toast, type ToastState } from './Toast';
import type { AdminUser, SellerProfile } from '@/lib/types';

const HEADERS = { 'content-type': 'application/json' };
type StoredRole = 'seller' | 'admin';

export function UsersAdmin({ initialUsers, currentEmail }: { initialUsers: AdminUser[]; currentEmail: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [newRoles, setNewRoles] = useState<StoredRole[]>(['seller']);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ user: AdminUser; data: SellerProfile } | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  async function reload() {
    const r = await fetch('/api/admin/users', { cache: 'no-store' });
    if (r.ok) setUsers(await r.json()); else notify('error', 'Could not refresh the list.');
  }
  async function call(url: string, method: string, body?: unknown): Promise<{ error: string | null; data: unknown }> {
    try {
      const r = await fetch(url, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await r.json().catch(() => null);
      return r.ok ? { error: null, data } : { error: (data as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.', data };
    } catch { return { error: 'Network error. Please try again.', data: null }; }
  }
  // A failed write shows the API error and does not re-fetch the list.
  async function act(key: string, fn: () => Promise<{ error: string | null }>, ok: string): Promise<boolean> {
    if (busy) return false;
    setBusy(key);
    const res = await fn();
    if (res.error) notify('error', res.error); else { notify('success', ok); await reload(); }
    setBusy(null);
    return !res.error;
  }
  const toggleRole = (u: AdminUser, role: StoredRole) => {
    const roles = u.roles.includes(role) ? u.roles.filter(r => r !== role) : [...u.roles, role];
    return act(`roles-${u.id}`, () => call(`/api/admin/users/${u.id}`, 'PATCH', { roles }), `${u.email} updated.`);
  };

  return (
    <section className="admin-posts">
      <div className="page-head">
        <h1>Users</h1>
        <p>Give people the seller or admin role. Sellers manage their own products; only admins publish. Deactivate a user instead of deleting when they own products, workshops, orders or bookings.</p>
      </div>
      <Toast toast={toast} onClose={closeToast} />
      <div className="admin-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <form className="admin-toolbar admin-form" onSubmit={e => {
            e.preventDefault();
            void act('add', () => call('/api/admin/users', 'POST', { email: email.trim(), name: name.trim() || undefined, roles: newRoles }), `${email.trim().toLowerCase()} added.`).then(done => { if (done) { setEmail(''); setName(''); } });
          }}>
            <label style={{ flex: 2, margin: 0 }}>
              <span className="lbl">Google account email</span>
              <input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="person@example.com" />
            </label>
            <label style={{ flex: 1, margin: 0 }}>Name (optional)<input maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
            <fieldset style={{ margin: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
              <legend>Roles</legend>
              {(['seller', 'admin'] as const).map(r => (
                <label key={r} style={{ margin: 0 }}>
                  <input type="checkbox" style={{ display: 'inline', width: 'auto', margin: '0 6px 0 0' }} checked={newRoles.includes(r)} onChange={() => setNewRoles(cur => cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r])} />
                  {r}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="button primary" disabled={busy === 'add'} style={{ alignSelf: 'flex-end' }}>Add user</button>
          </form>
          {users.length === 0 ? <div className="empty">No users yet.</div> : users.map(u => {
            const me = u.email.toLowerCase() === currentEmail.toLowerCase();
            const owns = u.products + u.workshops + u.orders + u.bookings > 0;
            return (
              <article key={u.id} className="admin-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} data-testid="user-row">
                <div className="admin-row-main">
                  <h3>{u.name}</h3>
                  <p>{u.email}{me ? ' (you)' : ''}</p>
                  <p className="admin-status-line">
                    {u.roles.map(r => <span key={r} className="badge role">{r}</span>)}
                    {!u.active && <span className="badge inactive">Inactive</span>}
                    <span className="muted">{u.products} products · {u.workshops} workshops · {u.orders} orders · {u.bookings} bookings</span>
                  </p>
                  <p className="admin-status-line">
                    {(['seller', 'admin'] as const).map(r => (
                      <label key={r} style={{ margin: 0, fontWeight: 500 }}>
                        <input type="checkbox" aria-label={`${r} role for ${u.email}`} style={{ display: 'inline', width: 'auto', margin: '0 6px 0 0' }} checked={u.roles.includes(r)} disabled={!!busy || (me && r === 'admin')} onChange={() => void toggleRole(u, r)} />
                        {r}
                      </label>
                    ))}
                  </p>
                </div>
                {confirming === u.id ? (
                  <div className="admin-confirm" role="group" aria-label={`Confirm delete ${u.email}`}>
                    <span>Delete {u.email}? This can’t be undone.</span>
                    <button type="button" className="button" onClick={() => setConfirming(null)}>Cancel</button>
                    <button type="button" className="button danger" onClick={() => { setConfirming(null); void act(`del-${u.id}`, () => call(`/api/admin/users/${u.id}`, 'DELETE'), `Deleted ${u.email}.`); }}>Yes, delete</button>
                  </div>
                ) : (
                  <div className="admin-row-actions">
                    {u.roles.length > 0 && (
                      <button type="button" className="button" aria-label={`Edit profile of ${u.email}`} onClick={async () => {
                        const r = await call(`/api/admin/users/${u.id}/profile`, 'GET');
                        if (r.error) notify('error', r.error); else setProfile({ user: u, data: r.data as SellerProfile });
                      }}>Profile</button>
                    )}
                    <button type="button" className="button" aria-label={u.active ? `Deactivate ${u.email}` : `Activate ${u.email}`} disabled={!!busy || me}
                      onClick={() => void act(`active-${u.id}`, () => call(`/api/admin/users/${u.id}`, 'PATCH', { active: !u.active }), `${u.email} ${u.active ? 'deactivated' : 'activated'}.`)}>
                      {u.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="button danger-outline" aria-label={`Delete ${u.email}`} disabled={!!busy || me} title={owns ? 'Owns products, workshops, orders or bookings: deactivate instead' : undefined} onClick={() => setConfirming(u.id)}>Delete</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
      {profile && (
        <ProfileDialog title={`Profile of ${profile.user.email}`} initial={profile.data} url={`/api/admin/users/${profile.user.id}/profile`} accountEmail={profile.user.email}
          onSaved={() => { setProfile(null); notify('success', 'Profile saved.'); }} onCancel={() => setProfile(null)} />
      )}
    </section>
  );
}
