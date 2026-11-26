import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { Button, ErrorState, Field, Loader } from './ui.jsx';

const sections = {
  profile: 'Profile, goals and settings', workouts: 'Workouts', meals: 'Meals', water: 'Water entries',
  daily: 'Daily check-ins', measurements: 'Measurements', reviews: 'Coach reviews',
};
const metadata = new Set(['id', 'userId', '_id', '__v']);

function fieldLabel(key) {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Value({ value }) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? <ol>{value.map((item, index) => <li key={index}><Value value={item} /></li>)}</ol> : '—';
  if (typeof value !== 'object') return String(value);
  const fields = Object.entries(value).filter(([key]) => !metadata.has(key));
  if (!fields.length) return '—';
  return <dl className="admin-detail-fields">{fields.map(([key, item]) => <div key={key}>
    <dt>{fieldLabel(key)}</dt><dd><Value value={item} /></dd>
  </div>)}</dl>;
}

function DetailContent({ id, section, page, setPage }) {
  const { data, error, loading, reload } = useApi(`/admin/users/${id}/details/${section}?page=${page}`);
  if (loading) return <Loader label="Loading member details" />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  if (section === 'profile') {
    return Object.keys(data.profile).length ? <Value value={data.profile} /> : <p>No profile details saved.</p>;
  }
  return <>
    {data.records.length ? data.records.map((record) => <details className="admin-detail-record" key={record.id}>
      <summary>{[record.date, record.time, record.session || record.slot || record.kind].filter(Boolean).join(' · ') || 'Record'}</summary>
      <Value value={record} />
    </details>) : <p>No records on this page.</p>}
    {data.total > data.pageSize && <div className="admin-actions">
      <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous records</Button>
      <span>Page {page} of {Math.ceil(data.total / data.pageSize)}</span>
      <Button variant="secondary" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next records</Button>
    </div>}
  </>;
}

export default function AdminMemberDetails({ id }) {
  const [section, setSection] = useState('');
  const [page, setPage] = useState(1);
  return <section className="admin-member-details" aria-label="Read-only member details">
    <h3>Member details</h3>
    <Field label="Read-only record section" as="select" value={section} onChange={(event) => { setSection(event.target.value); setPage(1); }}>
      <option value="">Choose a section</option>
      {Object.entries(sections).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </Field>
    {section && <DetailContent key={`${id}/${section}/${page}`} id={id} section={section} page={page} setPage={setPage} />}
  </section>;
}
