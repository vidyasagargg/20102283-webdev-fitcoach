import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { Button, Card, ErrorState, Field, Loader, ProgressBar, Ring } from '../components/ui.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import Icon from '../components/Icon.jsx';
import { fmtDay, nowTime } from '../utils/dates.js';
import { litres, num, numOrNull } from '../utils/format.js';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function TodayPage() {
  const { user } = useAuth();
  const { date, isToday, toast } = useUi();
  const { data, error, loading, reload } = useApi(`/daily/${date}`);
  const targets = user.profile.targets;

  if (loading && !data) return <Loader label="Loading your day" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { schedule, nutrition, waterMl, workouts, daily, review } = data;
  const trained = workouts.length > 0;
  const workoutStatus =
    schedule.dayStatus === 'skipped' ? 'Skipped' : schedule.dayStatus === 'complete_rest' ? 'Rest' : trained ? 'Done' : schedule.isRest ? 'Walk' : 'To do';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{isToday ? greeting() : fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{isToday ? `${user.name.split(' ')[0]}, here’s your day` : 'Day summary'}</h1>
        </div>
      </div>
      {!isToday && (
        <div className="banner" role="note">
          <Icon name="calendar" /> You are viewing {fmtDay(date)}. Anything you log or edit is saved to this day.
        </div>
      )}

      <Card className="rings-card">
        <div className="rings">
          <Ring label="Workout" value={trained || schedule.dayStatus !== 'normal' ? 1 : 0} max={1} status={workoutStatus} color="var(--accent)" />
          <Ring label="Calories" value={nutrition?.kcal ?? 0} max={targets.kcal} display={num(nutrition?.kcal ?? 0)} color="var(--orange)" />
          <Ring label="Protein" value={nutrition?.protein ?? 0} max={targets.proteinG} display={`${num(nutrition?.protein ?? 0)} g`} color="var(--green)" />
          <Ring label="Water" value={waterMl} max={targets.waterMl} display={litres(waterMl)} color="var(--blue)" />
        </div>
      </Card>

      <div className="grid-main">
        <SessionCard schedule={schedule} trained={trained} date={date} onChange={reload} toast={toast} />
        <QuickWater date={date} waterMl={waterMl} target={targets.waterMl} onChange={reload} toast={toast} />
        <BodyCheck date={date} daily={daily} targets={targets} schedule={schedule} onSaved={reload} toast={toast} />
        <CoachToday date={date} review={review} onChange={reload} toast={toast} />
      </div>
    </div>
  );
}

function SessionCard({ schedule, trained, date, onChange, toast }) {
  const { isToday } = useUi();
  const [busy, setBusy] = useState(false);
  const setStatus = async (status, msg) => {
    setBusy(true);
    try {
      await api.put(`/daily/${date}/status`, { status });
      toast(msg, 'success');
      onChange();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const gymLink = `/gym${date ? `?date=${date}` : ''}`;

  return (
    <Card
      title={isToday ? "Today’s session" : "Session"}
      className="session-card"
      action={schedule.cycleNumber && <span className="chip chip-muted">Cycle {schedule.cycleNumber}</span>}
    >
      <div className="session-hero">
        <div>
          <p className="session-name">{schedule.label}</p>
          {schedule.focus && <p className="muted">Focus: {schedule.focus}</p>}
        </div>
        {trained && (
          <span className="chip chip-good">
            <Icon name="check" size={16} /> Logged
          </span>
        )}
      </div>

      {schedule.dayStatus === 'normal' && schedule.exercises.length > 0 && (
        <ol className="session-list">
          {schedule.exercises.map((e) => (
            <li key={e.name}>
              <span>{e.name}</span>
              <span className="muted">
                {e.sets} × {e.reps}
              </span>
            </li>
          ))}
        </ol>
      )}
      {schedule.cardio && <p className="session-cardio">Cardio: {schedule.cardio}</p>}
      {schedule.dayStatus === 'skipped' && (
        <p>
          The plan moves forward a day. Tomorrow: <strong>{schedule.nextSession}</strong>.
        </p>
      )}
      {schedule.dayStatus === 'complete_rest' && <p>No workout, no planned walk. Eat on plan, drink your water and sleep well.</p>}

      <div className="btn-row">
        {schedule.dayStatus === 'normal' && !schedule.isRest && (
          <Link to={gymLink} className="btn btn-primary">
            <Icon name="gym" size={18} />
            <span>{trained ? 'View workout' : 'Log workout'}</span>
          </Link>
        )}
        {schedule.dayStatus === 'normal' && schedule.canSkip && !trained && (
          <Button variant="secondary" busy={busy} onClick={() => setStatus('skipped', 'Skipped. The plan has shifted by one day.')}>
            I did not go today
          </Button>
        )}
        {schedule.dayStatus === 'normal' && schedule.canCompleteRest && (
          <>
            <Link to={gymLink} className="btn btn-secondary">
              Log my walk
            </Link>
            <Button variant="ghost" busy={busy} onClick={() => setStatus('complete_rest', 'Complete rest day set.')}>
              Take a complete rest
            </Button>
          </>
        )}
        {schedule.dayStatus === 'skipped' && (
          <Button variant="secondary" busy={busy} onClick={() => setStatus('normal', 'Skip undone.')}>
            Undo skip
          </Button>
        )}
        {schedule.dayStatus === 'complete_rest' && (
          <Button variant="secondary" busy={busy} onClick={() => setStatus('normal', 'Back to active rest.')}>
            Switch back to active rest
          </Button>
        )}
      </div>
    </Card>
  );
}

function QuickWater({ date, waterMl, target, onChange, toast }) {
  const [busy, setBusy] = useState(null);
  const add = async (ml) => {
    setBusy(ml);
    try {
      await api.post('/water', { date, ml, time: nowTime() });
      toast(`+${ml} ml logged`, 'success');
      onChange();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card title="Water" action={<Link to={`/water?date=${date}`} className="link-sm">Details</Link>}>
      <p className="big-num">
        {litres(waterMl)} <span className="muted">of {litres(target)}</span>
      </p>
      <ProgressBar value={waterMl} max={target} label="Water progress" tone="blue" />
      <div className="btn-row">
        {[250, 500].map((ml) => (
          <Button key={ml} variant="secondary" icon="plus" busy={busy === ml} onClick={() => add(ml)}>
            {ml} ml
          </Button>
        ))}
      </div>
    </Card>
  );
}

function BodyCheck({ date, daily, targets, schedule, onSaved, toast }) {
  const init = (d) => ({
    weightKg: d?.weightKg ?? '',
    sleepHours: d?.sleepHours ?? '',
    steps: d?.steps ?? '',
    energy: d?.energy ?? '',
    painFlag: d?.painFlag ?? false,
    painNote: d?.painNote ?? '',
  });
  const [f, setF] = useState(init(daily));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  useEffect(() => setF(init(daily)), [daily, date]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save(e) {
    e?.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.put(`/daily/${date}`, {
        weightKg: numOrNull(f.weightKg),
        sleepHours: numOrNull(f.sleepHours),
        steps: numOrNull(f.steps),
        energy: numOrNull(f.energy),
        painFlag: f.painFlag,
        painNote: f.painNote,
      });
      toast('Body check saved', 'success');
      onSaved();
    } catch (err) {
      setErrors(err.fields);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  /** Steps from Apple Health via an iOS Shortcut that copies today's total. */
  async function pasteSteps() {
    try {
      const text = await navigator.clipboard.readText();
      const n = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (!n) throw new Error('No number on the clipboard');
      setF((s) => ({ ...s, steps: n }));
      toast(`Pasted ${n.toLocaleString('en')} steps. Tap Save.`, 'info');
    } catch {
      toast('Could not read the clipboard. Long-press the Steps box and paste.', 'error');
    }
  }

  const noStepTarget = schedule.dayStatus === 'complete_rest';
  return (
    <Card title="Body check">
      <form onSubmit={save} className="stack-sm">
        <div className="grid-2">
          <Field label="Morning weight" suffix="kg" type="number" step="0.05" inputMode="decimal" value={f.weightKg} onChange={set('weightKg')} error={errors.weightKg} />
          <Field label="Sleep" suffix="h" type="number" step="0.5" inputMode="decimal" value={f.sleepHours} onChange={set('sleepHours')} error={errors.sleepHours} />
          <Field label="Steps" type="number" inputMode="numeric" value={f.steps} onChange={set('steps')} error={errors.steps} />
          <Field label="Energy (1–5)" as="select" value={f.energy} onChange={set('energy')}>
            <option value="">–</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {['', '· drained', '· low', '· okay', '· good', '· great'][n]}
              </option>
            ))}
          </Field>
        </div>
        <div className="steps-row">
          <ProgressBar value={Number(f.steps) || 0} max={targets.stepsGoal} label="Steps progress" tone="green" />
          <span className="muted small">
            {noStepTarget ? 'No step target today' : `${num(Number(f.steps) || 0)} / ${num(targets.stepsGoal)} (min ${num(targets.stepsMin)})`}
          </span>
        </div>
        <button type="button" className="link-btn" onClick={pasteSteps}>
          Paste steps from Apple Health
        </button>
        <label className="check">
          <input type="checkbox" checked={f.painFlag} onChange={set('painFlag')} />
          <span>I have pain, dizziness or an injury</span>
        </label>
        {f.painFlag && (
          <>
            <Field label="What and where?" value={f.painNote} onChange={set('painNote')} maxLength={300} />
            <div className="alert alert-danger" role="alert">
              <Icon name="alert" /> Rest today and see a doctor before training again.
            </div>
          </>
        )}
        <Button type="submit" busy={busy}>
          Save body check
        </Button>
      </form>
    </Card>
  );
}

function CoachToday({ date, review, onChange, toast }) {
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      await api.post(`/coach/daily/${date}`);
      onChange();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return <ReviewCard review={review} onGenerate={generate} busy={busy} />;
}
