import { useEffect, useRef, useState } from 'react';
import { Button, Field } from './ui.jsx';
import Icon from './Icon.jsx';

export const EXERCISES = [
  'Smith machine squat', 'Barbell back squat', 'Leg press', 'Walking lunges', 'Romanian deadlift', 'Deadlift',
  'Leg extension', 'Lying leg curl', 'Seated leg curl', 'Standing calf raise', 'Seated calf raise', 'Hip thrust',
  'Bulgarian split squat', 'Hip abduction', 'Barbell bench press', 'Incline dumbbell press', 'Incline barbell press',
  'Machine chest press', 'Seated shoulder press', 'Seated dumbbell shoulder press', 'Cable fly', 'Lateral raise',
  'Triceps pushdown', 'Overhead triceps extension', 'Dips', 'Lat pulldown', 'Seated cable row', 'Assisted pull-up',
  'Reverse pec fly', 'Dumbbell curl', 'Hammer curl', 'Preacher curl', 'One-arm dumbbell row', 'T-bar row', 'Face pull',
  'Machine crunch', 'Plank', 'Hanging knee raise',
];
const SESSIONS = ['Legs 1', 'Push 1', 'Pull 1', 'Legs 2', 'Push 2', 'Pull 2', 'Active rest', 'Other'];

const blankSet = (prev) => ({ type: 'working', weightKg: prev?.weightKg ?? '', reps: prev?.reps ?? '', done: false });

/** Rest timer: starts when a set is ticked; 90 s for main lifts, 60 s otherwise. */
function RestTimer({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds);
  const endRef = useRef(Date.now() + seconds * 1000);
  useEffect(() => {
    endRef.current = Date.now() + seconds * 1000;
    setLeft(seconds);
  }, [seconds]);
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        navigator.vibrate?.(300);
        onDone();
      }
    }, 250);
    return () => clearInterval(t);
  }, [seconds, onDone]);
  const adjust = (d) => (endRef.current += d * 1000);
  return (
    <div className="rest-timer" role="timer" aria-live="off">
      <Icon name="clock" />
      <strong>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </strong>
      <span className="muted">rest</span>
      <button className="chip" onClick={() => adjust(-15)} type="button">−15</button>
      <button className="chip" onClick={() => adjust(15)} type="button">+15</button>
      <button className="chip" onClick={onDone} type="button">Skip</button>
    </div>
  );
}

/**
 * Edit every part of a workout before saving: date, session, exercises,
 * sets (type, weight, reps, done), cardio and notes. Used for new workouts,
 * pasted notes (after conversion) and edits of saved workouts.
 */
export default function WorkoutEditor({ initial, onSave, onCancel, busy, warnings = [], mainLifts = [] }) {
  const [w, setW] = useState(initial);
  const [timer, setTimer] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  useEffect(() => setW(initial), [initial]);

  const update = (fn) => setW((prev) => fn(structuredClone(prev)));
  const setEx = (i, patch) => update((d) => (Object.assign(d.exercises[i], patch), d));
  const setSet = (i, j, patch) =>
    update((d) => {
      Object.assign(d.exercises[i].sets[j], patch);
      return d;
    });

  const toggleDone = (i, j) => {
    const s = w.exercises[i].sets[j];
    setSet(i, j, { done: !s.done });
    if (!s.done) setTimer({ key: Date.now(), seconds: mainLifts.includes(w.exercises[i].name) ? 90 : 60 });
  };

  function submit(e) {
    e.preventDefault();
    const clean = {
      ...w,
      durationMin: w.durationMin === '' ? null : w.durationMin,
      feeling: w.feeling === '' ? null : w.feeling,
      exercises: w.exercises
        .filter((ex) => ex.name.trim())
        .map((ex) => ({
          ...ex,
          sets: ex.sets
            .filter((s) => s.weightKg !== '' || s.reps !== '')
            .map((s) => ({ ...s, weightKg: s.weightKg === '' ? null : Number(s.weightKg), reps: s.reps === '' ? null : Number(s.reps) })),
        })),
      cardio: w.cardio.filter((c) => c.minutes !== '' && c.minutes != null).map((c) => ({ ...c, minutes: Number(c.minutes), speed: c.speed === '' ? null : c.speed, incline: c.incline === '' ? null : c.incline })),
    };
    onSave(clean);
  }

  return (
    <form className="editor" onSubmit={submit}>
      {warnings.length > 0 && (
        <div className="alert alert-warn" role="status">
          <Icon name="alert" />
          <div>
            <strong>Check these before saving</strong>
            <ul>
              {warnings.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid-4">
        <Field label="Date" type="date" value={w.date} onChange={(e) => update((d) => ((d.date = e.target.value), d))} required />
        <Field label="Session" as="select" value={w.session ?? ''} onChange={(e) => update((d) => ((d.session = e.target.value), d))}>
          <option value="">–</option>
          {SESSIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Field>
        <Field label="Duration" suffix="min" type="number" inputMode="numeric" value={w.durationMin ?? ''} onChange={(e) => update((d) => ((d.durationMin = e.target.value), d))} />
        <Field label="How it felt" as="select" value={w.feeling ?? ''} onChange={(e) => update((d) => ((d.feeling = e.target.value), d))}>
          <option value="">–</option>
          {['', 'Very hard', 'Hard', 'Okay', 'Good', 'Great'].map((l, n) => n > 0 && <option key={l} value={n}>{l}</option>)}
        </Field>
      </div>

      <datalist id="exercise-names">
        {EXERCISES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {w.exercises.map((ex, i) => (
        <fieldset key={i} className="ex-card">
          <legend className="sr-only">Exercise {i + 1}</legend>
          <div className="ex-head">
            <input
              className="ex-name"
              list="exercise-names"
              value={ex.name}
              onChange={(e) => setEx(i, { name: e.target.value })}
              aria-label={`Exercise ${i + 1} name`}
              placeholder="Exercise name"
            />
            <label className="check small">
              <input type="checkbox" checked={Boolean(ex.perSide)} onChange={(e) => setEx(i, { perSide: e.target.checked })} />
              <span>per side</span>
            </label>
            <button type="button" className="icon-btn" aria-label={`Remove ${ex.name || 'exercise'}`} onClick={() => update((d) => (d.exercises.splice(i, 1), d))}>
              <Icon name="trash" size={18} />
            </button>
          </div>
          {ex.originalName && ex.originalName !== ex.name && <p className="muted small">From your notes: “{ex.originalName}”</p>}
          {ex.hint && <p className="hint-line">{ex.hint}</p>}
          <table className="sets">
            <thead>
              <tr>
                <th scope="col">Set</th>
                <th scope="col">Type</th>
                <th scope="col">kg{ex.perSide ? ' / side' : ''}</th>
                <th scope="col">Reps</th>
                <th scope="col"><span className="sr-only">Done</span></th>
                <th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {ex.sets.map((s, j) => (
                <tr key={j} className={s.done ? 'done' : ''}>
                  <td>{j + 1}</td>
                  <td>
                    <select value={s.type} onChange={(e) => setSet(i, j, { type: e.target.value })} aria-label={`Set ${j + 1} type`}>
                      <option value="warmup">Warm</option>
                      <option value="working">Work</option>
                      <option value="drop">Drop</option>
                    </select>
                  </td>
                  <td>
                    <input type="number" step="0.25" inputMode="decimal" value={s.weightKg ?? ''} onChange={(e) => setSet(i, j, { weightKg: e.target.value })} aria-label={`Set ${j + 1} weight`} />
                  </td>
                  <td>
                    <input type="number" inputMode="numeric" value={s.reps ?? ''} onChange={(e) => setSet(i, j, { reps: e.target.value })} aria-label={`Set ${j + 1} reps`} />
                  </td>
                  <td>
                    <button type="button" className={`tick ${s.done ? 'on' : ''}`} onClick={() => toggleDone(i, j)} aria-pressed={Boolean(s.done)} aria-label={`Mark set ${j + 1} done`}>
                      <Icon name="check" size={16} />
                    </button>
                  </td>
                  <td>
                    <button type="button" className="icon-btn" onClick={() => update((d) => (d.exercises[i].sets.splice(j, 1), d))} aria-label={`Remove set ${j + 1}`}>
                      <Icon name="close" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="link-btn" onClick={() => update((d) => (d.exercises[i].sets.push(blankSet(d.exercises[i].sets.at(-1))), d))}>
            + Add set
          </button>
        </fieldset>
      ))}
      <Button type="button" variant="secondary" icon="plus" onClick={() => update((d) => (d.exercises.push({ name: '', perSide: false, sets: [blankSet()] }), d))}>
        Add exercise
      </Button>

      <h3 className="section-title">Cardio</h3>
      {w.cardio.map((c, k) => (
        <div key={k} className="grid-cardio">
          <Field label="Type" value={c.type} onChange={(e) => update((d) => ((d.cardio[k].type = e.target.value), d))} />
          <Field label="Minutes" type="number" value={c.minutes ?? ''} onChange={(e) => update((d) => ((d.cardio[k].minutes = e.target.value), d))} />
          <Field label="Speed" type="number" step="0.1" value={c.speed ?? ''} onChange={(e) => update((d) => ((d.cardio[k].speed = e.target.value), d))} />
          <Field label="Incline" type="number" step="0.5" value={c.incline ?? ''} onChange={(e) => update((d) => ((d.cardio[k].incline = e.target.value), d))} />
          <button type="button" className="icon-btn" aria-label="Remove cardio" onClick={() => update((d) => (d.cardio.splice(k, 1), d))}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
      <button type="button" className="link-btn" onClick={() => update((d) => (d.cardio.push({ type: 'Treadmill', minutes: 20, speed: 4.5, incline: 5 }), d))}>
        + Add cardio
      </button>

      <Field label="Notes" as="textarea" rows={2} value={w.notes ?? ''} onChange={(e) => update((d) => ((d.notes = e.target.value), d))} />
      {w.rawText && (
        <div>
          <button type="button" className="link-btn" onClick={() => setShowRaw((v) => !v)} aria-expanded={showRaw}>
            {showRaw ? 'Hide' : 'Show'} original notes
          </button>
          {showRaw && <pre className="raw">{w.rawText}</pre>}
        </div>
      )}

      <div className="btn-row sticky-actions">
        <Button type="submit" busy={busy} icon="check">
          Save workout
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {timer && <RestTimer key={timer.key} seconds={timer.seconds} onDone={() => setTimer(null)} />}
    </form>
  );
}
