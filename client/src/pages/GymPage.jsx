import { useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useUi } from '../context/UiContext.jsx';
import { Button, Card, Empty, ErrorState, Field, Loader } from '../components/ui.jsx';
import WorkoutEditor from '../components/WorkoutEditor.jsx';
import Icon from '../components/Icon.jsx';
import { fmtShort } from '../utils/dates.js';

const toEditable = (w) => ({
  ...w,
  durationMin: w.durationMin ?? '',
  feeling: w.feeling ?? '',
  exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, weightKg: s.weightKg ?? '', reps: s.reps ?? '' })) })),
  cardio: w.cardio ?? [],
});

export default function GymPage() {
  const { date, toast } = useUi();
  const plan = useApi(`/schedule/${date}`);
  const list = useApi(`/workouts?date=${date}`);
  const [mode, setMode] = useState(null); // null | 'paste' | 'edit'
  const [draft, setDraft] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if ((plan.loading && !plan.data) || (list.loading && !list.data)) return <Loader label="Loading your session" />;
  if (plan.error || list.error) return <ErrorState error={plan.error || list.error} onRetry={() => (plan.reload(), list.reload())} />;
  const day = plan.data;
  const workouts = list.data ?? [];
  const hasPlannedExercises = day.exercises.length > 0;
  const mainLifts = day.exercises.filter((e) => e.main).map((e) => e.name);

  function startSetBySet() {
    setWarnings([]);
    setDraft({
      date,
      session: day.session ?? 'Other',
      durationMin: '',
      feeling: '',
      notes: '',
      exercises: day.exercises.map((e) => ({
        name: e.name,
        perSide: Boolean(e.perSide),
        hint: e.suggestion?.reason ?? `New exercise: pick a weight where the last 2 of ${e.reps} reps are hard.`,
        sets: Array.from({ length: e.sets }, () => ({ type: 'working', weightKg: e.suggestion?.weightKg ?? '', reps: '', done: false })),
      })),
      cardio: hasPlannedExercises && day.cardio ? [{ type: 'Treadmill', minutes: 20, speed: 4.5, incline: 5 }] : [],
    });
    setMode('edit');
  }

  function startWalk() {
    setWarnings([]);
    setDraft({ date, session: 'Active rest', durationMin: '', feeling: '', notes: '', exercises: [], cardio: [{ type: 'Walk', minutes: 35, speed: '', incline: '' }] });
    setMode('edit');
  }

  async function convert() {
    setBusy(true);
    try {
      const r = await api.post('/workouts/parse', { text, date });
      setWarnings([...(r.warnings ?? []), ...(r.unparsed?.length ? [`Could not read: ${r.unparsed.join(' · ')}`] : [])]);
      setDraft({ date: r.date ?? date, session: r.session ?? day.session ?? '', durationMin: '', feeling: '', notes: '', rawText: text, exercises: r.exercises, cardio: r.cardio });
      setMode('edit');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save(w) {
    setBusy(true);
    try {
      const { id, userId: _u, createdAt: _c, updatedAt: _up, ...body } = w;
      body.exercises = body.exercises.map(({ hint: _h, ...ex }) => ex);
      if (id) await api.put(`/workouts/${id}`, body);
      else await api.post('/workouts', body);
      toast(id ? 'Workout updated' : 'Workout saved', 'success');
      setMode(null);
      setDraft(null);
      setText('');
      list.reload();
      plan.reload();
    } catch (e) {
      const fieldMsgs = Object.values(e.fields ?? {});
      toast(fieldMsgs[0] ? `${e.message}: ${fieldMsgs[0]}` : e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(w) {
    if (!window.confirm(`Delete the ${w.session ?? ''} workout from ${fmtShort(w.date)}?`)) return;
    try {
      await api.del(`/workouts/${w.id}`);
      toast('Workout deleted', 'success');
      list.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (mode === 'edit' && draft) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>{draft.id ? 'Edit workout' : 'Review and save'}</h1>
        </div>
        <Card>
          <WorkoutEditor initial={draft} onSave={save} onCancel={() => setMode(null)} busy={busy} warnings={warnings} mainLifts={mainLifts} />
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">{day.cycleNumber ? `Cycle ${day.cycleNumber}` : 'Gym'}</p>
          <h1>{day.label}</h1>
          {day.focus && <p className="muted">Focus: {day.focus}</p>}
        </div>
      </div>

      <div className="grid-main">
        <Card title="Log this session">
          {day.dayStatus === 'skipped' ? (
            <p>This session was skipped. Logging a workout here is still fine, and the skip is kept unless you undo it on Today.</p>
          ) : day.dayStatus === 'complete_rest' ? (
            <p>Complete rest day: nothing to log. Enjoy it.</p>
          ) : null}
          {mode === 'paste' ? (
            <div className="stack-sm">
              <Field
                label="Paste your gym notes"
                as="textarea"
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'Legs 1 - 19 Oct\nSmith squat\n1. 17.5kg ~ 10 reps\n2. 17.5kg ~ 9 reps\nLeg press 60kg x 12\nTreadmill 20 min speed 4.5 incline 5'}
                hint="Your own format works: numbered sets, kg ~ reps, drop sets with +, warm-ups, 3x12 @ 20kg, cardio lines."
              />
              <div className="btn-row">
                <Button onClick={convert} busy={busy} disabled={!text.trim()} icon="spark">
                  Convert to app format
                </Button>
                <Button variant="ghost" onClick={() => setMode(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="choice-grid">
              <button className="choice" onClick={() => setMode('paste')}>
                <Icon name="clipboard" size={26} />
                <strong>Paste workout notes</strong>
                <span>Convert what you typed at the gym</span>
              </button>
              {day.isRest ? (
                <button className="choice" onClick={startWalk}>
                  <Icon name="today" size={26} />
                  <strong>Log active rest walk</strong>
                  <span>Minutes, speed and incline</span>
                </button>
              ) : (
                <button className="choice" onClick={startSetBySet}>
                  <Icon name="gym" size={26} />
                  <strong>Log set by set</strong>
                  <span>{hasPlannedExercises ? 'Planned exercises with suggested weights and a rest timer' : 'Add your own exercises and sets'}</span>
                </button>
              )}
            </div>
          )}
        </Card>

        <Card title={`Saved for ${fmtShort(date)}`}>
          {workouts.length === 0 ? (
            <Empty icon="gym" title="No workout saved for this day yet" />
          ) : (
            workouts.map((w) => (
              <article key={w.id} className="saved-workout">
                <header>
                  <strong>{w.session ?? 'Workout'}</strong>
                  <div className="btn-row tight">
                    <Button variant="ghost" size="sm" icon="edit" onClick={() => (setWarnings([]), setDraft(toEditable(w)), setMode('edit'))}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" icon="trash" onClick={() => remove(w)} aria-label="Delete workout" />
                  </div>
                </header>
                <ul className="saved-list">
                  {w.exercises.map((e) => (
                    <li key={e.name}>
                      <span>{e.name}</span>
                      <span className="muted">
                        {e.sets
                          .filter((s) => s.type !== 'warmup')
                          .map((s) => `${s.weightKg ?? 'BW'}${s.type === 'drop' ? '↓' : ''}×${s.reps ?? '?'}`)
                          .join(', ')}
                        {e.perSide ? ' (per side)' : ''}
                      </span>
                    </li>
                  ))}
                  {w.cardio?.map((c, i) => (
                    <li key={`c${i}`}>
                      <span>{c.type}</span>
                      <span className="muted">
                        {c.minutes} min{c.speed ? ` · speed ${c.speed}` : ''}{c.incline ? ` · incline ${c.incline}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </Card>

        {day.exercises.length > 0 && (
          <Card title="Plan and progression" className="span-2">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Exercise</th>
                  <th scope="col">Target</th>
                  <th scope="col">Last time</th>
                  <th scope="col">Next</th>
                </tr>
              </thead>
              <tbody>
                {day.exercises.map((e) => (
                  <tr key={e.name}>
                    <td>
                      {e.name}
                      {e.perSide && <span className="muted small"> per side</span>}
                    </td>
                    <td>
                      {e.sets} × {e.reps}
                    </td>
                    <td className="muted">{e.last ? `${e.last.sets.map((s) => `${s.weightKg}×${s.reps}`).join(', ')} (${fmtShort(e.last.date)})` : 'No history'}</td>
                    <td>
                      {e.suggestion ? (
                        <span className={e.suggestion.increase ? 'chip chip-good' : 'chip chip-muted'} title={e.suggestion.reason}>
                          {e.suggestion.increase && <Icon name="up" size={14} />} {e.suggestion.weightKg} kg
                        </span>
                      ) : (
                        '–'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {day.cardio && <p className="session-cardio">Cardio: {day.cardio}</p>}
          </Card>
        )}

        <Card title="Coming up" className="span-2">
          <ol className="upcoming">
            {day.upcoming.map((u) => (
              <li key={u.date} className={u.date === date ? 'current' : ''}>
                <span className="muted small">{fmtShort(u.date)}</span>
                <strong>{u.session ?? '–'}</strong>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
