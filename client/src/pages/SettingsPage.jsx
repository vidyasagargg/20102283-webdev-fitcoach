import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { Button, Card, Field } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { numOrNull } from '../utils/format.js';
import { todayIso } from '../utils/dates.js';

const TARGETS = [
  ['kcal', 'Calories', 'kcal'],
  ['proteinG', 'Protein', 'g'],
  ['carbsG', 'Carbs', 'g'],
  ['fatG', 'Fat', 'g'],
  ['fibreG', 'Fibre', 'g'],
  ['sugarMaxG', 'Sugar limit', 'g'],
  ['waterMl', 'Water', 'ml'],
  ['stepsMin', 'Steps minimum', ''],
  ['stepsGoal', 'Steps goal', ''],
  ['sleepHours', 'Sleep', 'h'],
];
const GOALS = [
  ['targetWeightMinKg', 'Target weight from', 'kg'],
  ['targetWeightMaxKg', 'Target weight to', 'kg'],
  ['targetWaistMinCm', 'Target waist from', 'cm'],
  ['targetWaistMaxCm', 'Target waist to', 'cm'],
  ['longTermBodyFatPct', 'Long-term body fat', '%'],
  ['longTermWeightKg', 'Long-term weight', 'kg'],
];

export default function SettingsPage() {
  const { user, saveProfile, logout } = useAuth();
  const { toast } = useUi();
  const navigate = useNavigate();
  const p = user.profile;
  const [f, setF] = useState(() => ({
    name: user.name,
    age: p.age ?? '',
    heightCm: p.heightCm ?? '',
    dietNotes: p.dietNotes ?? '',
    cycleStart: p.schedule.cycleStart ?? todayIso(),
    targetDate: p.goals.targetDate ?? '',
    minKcal: p.safety.minKcal,
    maxWeeklyLossKg: p.safety.maxWeeklyLossKg,
    ...Object.fromEntries(TARGETS.map(([k]) => [k, p.targets[k] ?? ''])),
    ...Object.fromEntries(GOALS.map(([k]) => [k, p.goals[k] ?? ''])),
  }));
  const [reminders, setReminders] = useState(p.reminders);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await saveProfile({
        name: f.name,
        profile: {
          age: numOrNull(f.age),
          heightCm: numOrNull(f.heightCm),
          dietNotes: f.dietNotes,
          schedule: { cycleStart: f.cycleStart },
          targets: Object.fromEntries(TARGETS.map(([k]) => [k, numOrNull(f[k])])),
          goals: { ...Object.fromEntries(GOALS.map(([k]) => [k, numOrNull(f[k])])), targetDate: f.targetDate || null },
          safety: { minKcal: numOrNull(f.minKcal), maxWeeklyLossKg: numOrNull(f.maxWeeklyLossKg) },
          reminders: reminders.filter((r) => r.label.trim() && r.time),
        },
      });
      toast('Settings saved', 'success');
    } catch (err) {
      setErrors(Object.fromEntries(Object.entries(err.fields ?? {}).map(([k, v]) => [k.split('.').pop(), v])));
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      await api.post('/auth/change-password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password changed. Other devices are signed out.', 'success');
    } catch (err) {
      toast(Object.values(err.fields ?? {})[0] ?? err.message, 'error');
    }
  }

  async function deleteAccount() {
    if (window.prompt('This permanently deletes your account and all logs. Type DELETE to confirm.') !== 'DELETE') return;
    await api.del('/profile');
    await logout();
    navigate('/login');
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="page">
      <div className="page-head">
        <h1>Settings</h1>
        <Button variant="ghost" icon="logout" onClick={logout}>Sign out</Button>
      </div>
      <form onSubmit={save} className="grid-main">
        <Card title="Profile">
          <Field label="Name" value={f.name} onChange={set('name')} error={errors.name} />
          <div className="grid-2">
            <Field label="Age" type="number" value={f.age} onChange={set('age')} error={errors.age} />
            <Field label="Height" suffix="cm" type="number" value={f.heightCm} onChange={set('heightCm')} error={errors.heightCm} />
          </div>
          <Field label="Diet notes" value={f.dietNotes} onChange={set('dietNotes')} />
          <Field label="Training cycle day 1" type="date" value={f.cycleStart} onChange={set('cycleStart')} hint={`Cycle: ${p.schedule.cycle.join(' → ')}`} />
        </Card>

        <Card title="Goals">
          <div className="grid-2">
            {GOALS.map(([k, label, suffix]) => (
              <Field key={k} label={label} suffix={suffix} type="number" step="0.1" value={f[k]} onChange={set(k)} error={errors[k]} />
            ))}
          </div>
          <Field label="Checkpoint date" type="date" value={f.targetDate} onChange={set('targetDate')} hint="Shown on the weight chart. Tracking continues after it." />
        </Card>

        <Card title="Daily targets">
          <div className="grid-2">
            {TARGETS.map(([k, label, suffix]) => (
              <Field key={k} label={label} suffix={suffix} type="number" value={f[k]} onChange={set(k)} error={errors[k]} />
            ))}
          </div>
        </Card>

        <Card title="Safety limits">
          <p className="muted small">The weekly review never sets calories below this floor or pushes loss past this rate.</p>
          <div className="grid-2">
            <Field label="Minimum calories" suffix="kcal" type="number" value={f.minKcal} onChange={set('minKcal')} error={errors.minKcal} />
            <Field label="Max loss per week" suffix="kg" type="number" step="0.1" value={f.maxWeeklyLossKg} onChange={set('maxWeeklyLossKg')} error={errors.maxWeeklyLossKg} />
          </div>
        </Card>

        <Card title="Reminders" className="span-2">
          <p className="muted small">
            Add these to your phone calendar so they arrive even when the app is closed. Time zone: {tz}.
          </p>
          <ul className="reminder-list">
            {reminders.map((r, i) => (
              <li key={i}>
                <input type="time" value={r.time} onChange={(e) => setReminders((rs) => rs.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} aria-label="Reminder time" />
                <input value={r.label} onChange={(e) => setReminders((rs) => rs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Reminder label" maxLength={60} />
                <button type="button" className="icon-btn" onClick={() => setReminders((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${r.label}`}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <div className="btn-row">
            <Button type="button" variant="ghost" icon="plus" onClick={() => setReminders((rs) => [...rs, { label: 'New reminder', time: '12:00' }])}>
              Add reminder
            </Button>
            <a className="btn btn-secondary" href={`/api/export/reminders.ics?tz=${encodeURIComponent(tz)}&days=28`} download>
              <Icon name="calendar" size={18} />
              <span>Add to calendar (.ics)</span>
            </a>
          </div>
          <p className="muted small">Save your changes before downloading the calendar file.</p>
        </Card>

        <div className="span-2 sticky-actions">
          <Button type="submit" busy={busy} icon="check">Save settings</Button>
        </div>
      </form>

      <div className="grid-main">
        <Card title="Password">
          <form onSubmit={changePassword} className="stack-sm">
            <Field label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            <Field label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="10+ characters with upper case, lower case and a number" />
            <Button type="submit" variant="secondary" disabled={!pw.currentPassword || !pw.newPassword}>Change password</Button>
          </form>
        </Card>
        <Card title="Your data">
          <div className="stack-sm">
            <a className="btn btn-secondary" href="/api/export/data.json" download>Download all my data (JSON)</a>
            <Button variant="secondary" onClick={async () => (await api.post('/auth/logout-all'), logout())}>Sign out on all devices</Button>
            <Button variant="danger" onClick={deleteAccount}>Delete account</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
