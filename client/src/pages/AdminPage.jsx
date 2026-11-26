import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { Button, Card, ErrorState, Field, Loader, Stat } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';

const labels = {
  users: 'Accounts', workouts: 'Workouts', meals: 'Meals', water: 'Water entries',
  daily: 'Daily logs', measurements: 'Measurements', reviews: 'Coach reviews',
};

function Usage({ counts }) {
  return <div className="admin-stats">
    {Object.entries(counts).map(([key, value]) => <Stat key={key} label={labels[key]} value={value} />)}
  </div>;
}

function AccountSupport({ id, onUpdated }) {
  const { data, loading, error, reload, setData } = useApi(`/admin/users/${id}`);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [loading]);
  if (loading) return <Card><Loader label="Loading account details" /></Card>;
  if (error || !data) return <Card><ErrorState error={error} onRetry={reload} /></Card>;
  const { user, counts } = data;

  async function act(action, label) {
    if (!window.confirm(`${label} for ${user.email}?`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await api.post(`/admin/users/${id}/actions`, { action });
      setData({ user: updated, counts });
      setFeedback({ message: action === 'revoke-sessions' ? 'All sessions were revoked.' : `Account ${updated.suspended ? 'suspended' : 'reactivated'}.` });
      onUpdated();
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return <Card aria-label="Account details">
    <h2 className="card-title" ref={heading} tabIndex={-1}>{user.name}</h2>
    <p className="admin-email">{user.email}</p>
    <p>{user.role === 'admin' ? 'Administrator' : 'Member'} · {user.suspended ? 'Suspended' : 'Active'} · {user.onboarded ? 'Onboarded' : 'Onboarding pending'}</p>
    {user.createdAt && <p className="muted">Joined {new Date(user.createdAt).toLocaleDateString()}</p>}
    <h3>Account activity totals</h3>
    <Usage counts={counts} />
    <div className="admin-actions">
      <a className="btn btn-secondary" href={`mailto:${encodeURIComponent(user.email)}`}>Email user</a>
      {user.role !== 'admin' && <>
        <Button variant="secondary" disabled={busy} onClick={() => act('revoke-sessions', 'Revoke all sessions')}>Revoke sessions</Button>
        <Button variant="secondary" disabled={busy} onClick={() => user.suspended ? act('reactivate', 'Reactivate account') : act('suspend', 'Suspend account')}>{user.suspended ? 'Reactivate' : 'Suspend'}</Button>
      </>}
    </div>
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </Card>;
}

export default function AdminPage() {
  const { logout } = useAuth();
  const [draft, setDraft] = useState('');
  const [email, setEmail] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const stats = useApi('/admin/stats');
  const query = new URLSearchParams({ page });
  if (email) query.set('email', email);
  const accounts = useApi(`/admin/users?${query}`);

  function search(value) {
    setSelected(null);
    setPage(1);
    setEmail(value.trim());
  }

  function goTo(next) {
    setSelected(null);
    setPage(next);
  }

  return <div className="page">
    <header className="page-head"><h1>Admin portal</h1><Button variant="secondary" onClick={logout}>Sign out</Button></header>
    <Card title="Platform activity" action={<Button variant="secondary" size="sm" onClick={stats.reload}>Refresh</Button>}>
      {stats.loading ? <Loader /> : stats.error ? <ErrorState error={stats.error} onRetry={stats.reload} /> : stats.data && <Usage counts={stats.data.counts} />}
    </Card>
    <Card title="User accounts">
      <form className="admin-actions" onSubmit={(event) => { event.preventDefault(); search(draft); }}>
        <Field label="Search by full email" type="email" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <Button type="submit">Search</Button>
        {email && <Button type="button" variant="secondary" onClick={() => { setDraft(''); search(''); }}>Clear</Button>}
      </form>
      {accounts.loading ? <Loader label="Loading accounts" /> : accounts.error ? <ErrorState error={accounts.error} onRetry={accounts.reload} /> : accounts.data && <>
        {accounts.data.users.length ? <ul className="admin-users">
          {accounts.data.users.map((user) => <li key={user.id}>
            <div><strong>{user.name}</strong><p className="admin-email muted">{user.email}</p></div>
            <Button variant="secondary" size="sm" aria-label={`View ${user.email}`} aria-pressed={selected === user.id} onClick={() => setSelected(user.id)}>{user.suspended ? 'Suspended · View' : 'View'}</Button>
          </li>)}
        </ul> : <p>No matching accounts.</p>}
        {accounts.data.total > accounts.data.pageSize && <div className="admin-actions">
          <Button variant="secondary" disabled={page === 1} onClick={() => goTo(page - 1)}>Previous</Button>
          <span>Page {page} of {Math.ceil(accounts.data.total / accounts.data.pageSize)}</span>
          <Button variant="secondary" disabled={page * accounts.data.pageSize >= accounts.data.total} onClick={() => goTo(page + 1)}>Next</Button>
        </div>}
      </>}
    </Card>
    {selected && <AccountSupport key={selected} id={selected} onUpdated={accounts.reload} />}
  </div>;
}
