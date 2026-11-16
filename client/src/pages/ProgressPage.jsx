import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { Button, Card, Empty, ErrorState, Field, Loader, Segmented, Stat } from '../components/ui.jsx';
import { WeightChart, DailyBarChart, LiftChart } from '../components/Charts.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import Icon from '../components/Icon.jsx';
import { addDays, fmtDay, fmtShort, todayIso, weekEndingSaturday } from '../utils/dates.js';
import { cmToIn, inToCm, num } from '../utils/format.js';

const RANGES = [
  { value: 28, label: '4 wk' },
  { value: 91, label: '3 mo' },
  { value: 182, label: '6 mo' },
  { value: 365, label: '1 yr' },
  { value: 'all', label: 'All' },
];

export default function ProgressPage() {
  const { user } = useAuth();
  const [range, setRange] = useState(28);
  const to = todayIso();
  const start = user.profile.startDate ?? user.profile.schedule?.cycleStart ?? addDays(to, -28);
  const from = range === 'all' ? (start < to ? start : addDays(to, -28)) : addDays(to, -(range - 1));
  const { data, error, loading, reload } = useApi(`/progress?from=${from}&to=${to}`);

  if (loading && !data) return <Loader label="Crunching your progress" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const d = data;
  const t = d.targets;
  const first = d.weight.find((w) => w.avg7 != null)?.avg7;
  const change = first != null && d.latestAvgWeight != null ? d.latestAvgWeight - first : null;

  const weightSummary = [
    d.latestAvgWeight != null && `7-day average ${num(d.latestAvgWeight, 2)} kg`,
    change != null && `${change <= 0 ? 'down' : 'up'} ${num(Math.abs(change), 2)} kg in this range`,
    d.projection?.kgPerWeek != null && `trend ${d.projection.kgPerWeek > 0 ? '+' : ''}${d.projection.kgPerWeek} kg/week`,
    d.projection?.goalDate && `reaching ${d.projection.goalKg} kg around ${fmtDay(d.projection.goalDate, { day: 'numeric', month: 'short', year: 'numeric' })} at this rate`,
    d.projection && !d.projection.goalDate && d.projection.kgPerWeek > -0.1 && 'weight is flat, so no goal date is projected',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Since {fmtDay(start, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          <h1>Progress</h1>
        </div>
        <Segmented options={RANGES} value={range} onChange={setRange} label="Date range" />
      </div>

      <div className="stats-row">
        <Stat label="Avg weight (7 d)" value={d.latestAvgWeight != null ? `${num(d.latestAvgWeight, 1)} kg` : '–'} sub={change != null ? `${change <= 0 ? '▼' : '▲'} ${num(Math.abs(change), 2)} kg` : 'Log weigh-ins'} tone={change != null && change <= 0 ? 'good' : undefined} />
        <Stat label="Workouts" value={d.counts.workouts} sub={`cardio on ${d.counts.cardioSessions} days`} />
        <Stat label="Avg calories" value={num(d.averages.kcal)} sub={`target ${num(t.kcal)}`} />
        <Stat label="Avg protein" value={d.averages.protein != null ? `${d.averages.protein} g` : '–'} sub={`target ${t.proteinG} g`} tone={d.averages.protein >= t.proteinG * 0.9 ? 'good' : undefined} />
        <Stat label="Avg steps" value={num(d.averages.steps)} sub={`goal ${num(t.stepsGoal)}`} />
        <Stat label="Avg water" value={d.averages.waterMl ? `${(d.averages.waterMl / 1000).toFixed(1)} L` : '–'} sub={`${d.streak}-day logging streak`} />
      </div>

      <div className="grid-main">
        <Card className="span-2">
          {d.weight.some((w) => w.weightKg != null) ? (
            <WeightChart data={d.weight} goalMin={d.goals.targetWeightMinKg} goalMax={d.goals.targetWeightMaxKg} goalDate={d.goals.targetDate} summary={weightSummary} />
          ) : (
            <Empty icon="progress" title="No weigh-ins in this range">Add your morning weight in the Body check on Today.</Empty>
          )}
          <p className="legend">
            <span className="legend-line" /> 7-day average <span className="legend-dot" /> daily weigh-in <span className="legend-band" /> target range
          </p>
        </Card>

        <Card>
          <DailyBarChart title="Calories" data={d.nutrition} dataKey="kcal" target={t.kcal} unit="kcal" summary={d.averages.kcal ? `Average ${num(d.averages.kcal)} kcal on logged days.` : 'No meals logged in this range.'} />
        </Card>
        <Card>
          <DailyBarChart title="Protein" data={d.nutrition} dataKey="protein" target={t.proteinG} unit="g" summary={d.averages.protein ? `Average ${d.averages.protein} g. Fibre ${d.averages.fibre ?? '–'} g, sugar ${d.averages.sugar ?? '–'} g.` : ''} />
        </Card>

        <LiftProgress lifts={d.lifts} />
        <MeasurementHistory baseline={d.baseline} entries={d.measurements.entries} onChange={reload} />
        <WeeklyReview />
        <WorkoutHistory workouts={d.workouts} />
      </div>
    </div>
  );
}

function LiftProgress({ lifts }) {
  // Main compound lifts first, then the most-logged exercises
  const MAIN = ['Smith machine squat', 'Barbell bench press', 'Leg press', 'Lat pulldown', 'Romanian deadlift'];
  const rank = (n) => (MAIN.includes(n) ? MAIN.indexOf(n) : MAIN.length);
  const names = Object.keys(lifts).sort((a, b) => rank(a) - rank(b) || lifts[b].length - lifts[a].length);
  const [name, setName] = useState(names[0]);
  useEffect(() => {
    if (!lifts[name]) setName(names[0]);
  }, [lifts, name, names]);
  if (!names.length)
    return (
      <Card title="Lift progress" className="span-2">
        <Empty icon="gym" title="No lifts logged in this range" />
      </Card>
    );
  const series = lifts[name] ?? [];
  const firstW = series[0]?.weightKg;
  const lastW = series.at(-1)?.weightKg;
  return (
    <Card title="Lift progress" className="span-2" action={
      <select value={name} onChange={(e) => setName(e.target.value)} aria-label="Choose exercise" className="select-sm">
        {names.map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
    }>
      <p className="muted small">
        {series.length} sessions · {firstW} → {lastW} kg{series.at(-1)?.perSide ? ' per side' : ''}
        {series.at(-1)?.assisted ? ' assistance' : ''}
        {series.at(-1)?.assisted
          ? lastW < firstW && <span className="text-good"> ({Math.round((firstW - lastW) * 10) / 10} kg less assistance)</span>
          : lastW > firstW && <span className="text-good"> (+{Math.round((lastW - firstW) * 10) / 10} kg)</span>}
      </p>
      {series.length > 0 && <LiftChart name={name} data={series} />}
    </Card>
  );
}

const MEASURES = [
  ['waistCm', 'Waist', -1],
  ['bellyCm', 'Belly', -1],
  ['hipsCm', 'Hips', -1],
  ['chestCm', 'Chest', 1],
  ['bicepsCm', 'Biceps', 1],
  ['thighsCm', 'Thighs', -1],
];

function Delta({ now, base, good }) {
  if (now == null || base == null) return null;
  const dcm = Math.round((now - base) * 10) / 10;
  if (dcm === 0) return <span className="muted small">no change</span>;
  const better = Math.sign(dcm) === good;
  return (
    <span className={`small ${better ? 'text-good' : 'text-bad'}`}>
      <Icon name={dcm < 0 ? 'down' : 'up'} size={12} /> {Math.abs(cmToIn(dcm))} in ({Math.abs(dcm)} cm)
    </span>
  );
}

/** Tape measurements: one compact card, pick a date, compare with the first entry. */
function MeasurementHistory({ entries, onChange }) {
  const { toast } = useUi();
  const sorted = useMemo(() => [...entries].sort((a, b) => (a.date < b.date ? 1 : -1)), [entries]);
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const base = entries[0];
  const cur = sorted[Math.min(idx, sorted.length - 1)];

  const startForm = (entry) =>
    setForm({ date: entry?.date ?? todayIso(), ...Object.fromEntries(MEASURES.map(([k]) => [k, entry?.[k] != null ? cmToIn(entry[k]) : ''])) });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/measurements', { date: form.date, ...Object.fromEntries(MEASURES.map(([k]) => [k, inToCm(form[k])])) });
      toast('Measurements saved', 'success');
      setForm(null);
      setIdx(0);
      onChange();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Tape measurements" action={!form && <Button size="sm" variant="secondary" icon="plus" onClick={() => startForm(null)}>Add</Button>}>
      {form ? (
        <form onSubmit={save} className="stack-sm">
          <Field label="Measured on" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid-2">
            {MEASURES.map(([k, label]) => (
              <Field key={k} label={label} suffix="in" type="number" step="0.1" inputMode="decimal" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} hint={form[k] ? `${inToCm(form[k])} cm` : ' '} />
            ))}
          </div>
          <div className="btn-row">
            <Button type="submit" busy={busy}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      ) : !cur ? (
        <Empty icon="progress" title="No measurements yet">Measure waist and belly every Saturday morning.</Empty>
      ) : (
        <>
          <div className="history-nav">
            <button className="icon-btn" onClick={() => setIdx((i) => Math.min(sorted.length - 1, i + 1))} disabled={idx >= sorted.length - 1} aria-label="Older entry">
              <Icon name="left" />
            </button>
            <select value={cur.date} onChange={(e) => setIdx(sorted.findIndex((m) => m.date === e.target.value))} aria-label="Measurement date">
              {sorted.map((m, i) => (
                <option key={m.date} value={m.date}>
                  {fmtDay(m.date)}{i === 0 ? ' (latest)' : ''}
                </option>
              ))}
            </select>
            <button className="icon-btn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label="Newer entry">
              <Icon name="right" />
            </button>
            <span className="muted small">{idx + 1} of {sorted.length}</span>
          </div>
          <dl className="measure-list">
            {MEASURES.filter(([k]) => cur[k] != null).map(([k, label, good]) => (
              <div key={k}>
                <dt>{label}</dt>
                <dd>
                  <strong>{cmToIn(cur[k])} in</strong> <span className="muted">({cur[k]} cm)</span>
                  {base && base.date !== cur.date && <Delta now={cur[k]} base={base[k]} good={good} />}
                </dd>
              </div>
            ))}
          </dl>
          {base && base.date !== cur.date && <p className="muted small">Compared with your first entry on {fmtDay(base.date)}. Green means moving the right way.</p>}
          <button className="link-btn" onClick={() => startForm(cur)}>Edit this entry</button>
        </>
      )}
    </Card>
  );
}

function WeeklyReview() {
  const { toast } = useUi();
  const reviews = useApi('/coach/reviews?kind=weekly&limit=52');
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const saturday = weekEndingSaturday(todayIso());
  const list = reviews.data ?? [];

  async function generate() {
    setBusy(true);
    try {
      await api.post(`/coach/weekly/${saturday}`);
      await reviews.reload();
      setSel(0);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const current = list[Math.min(sel, list.length - 1)];
  return (
    <div className="span-2 stack-sm">
      <div className="row-between">
        <h2 className="section-title">Weekly review</h2>
        <div className="btn-row tight">
          {list.length > 1 && (
            <select value={sel} onChange={(e) => setSel(Number(e.target.value))} aria-label="Choose week" className="select-sm">
              {list.map((r, i) => (
                <option key={r.id} value={i}>Week ending {fmtShort(r.date)}</option>
              ))}
            </select>
          )}
          <Button size="sm" icon="spark" onClick={generate} busy={busy}>
            Review week ending {fmtShort(saturday)}
          </Button>
        </div>
      </div>
      <ReviewCard review={current} title={current ? `Week ending ${fmtDay(current.date)}` : 'No weekly review yet'} emptyText="Every Saturday, review the week: average weight, tape, lifts and adherence. Calories are never set below your safety floor." />
    </div>
  );
}

function WorkoutHistory({ workouts }) {
  const reviews = useApi('/coach/reviews?kind=daily&limit=60');
  return (
    <>
      <Card title="Workout history">
        {workouts.length === 0 ? (
          <Empty icon="gym" title="No workouts in this range" />
        ) : (
          <ul className="history-list scroll-list">
            {workouts.map((w) => (
              <li key={w.id}>
                <div>
                  <strong>{w.session ?? 'Workout'}</strong>
                  <span className="muted small">
                    {fmtDay(w.date)} · {w.exercises} exercises · {w.sets} sets{w.cardioMin ? ` · ${w.cardioMin} min cardio` : ''}
                  </span>
                </div>
                <Link to={`/gym?date=${w.date}`} className="link-sm">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Coach review history">
        {!reviews.data?.length ? (
          <Empty icon="spark" title="No daily reviews yet" />
        ) : (
          <ul className="history-list scroll-list">
            {reviews.data.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.content.headline}</strong>
                  <span className="muted small">{fmtDay(r.date)} · {r.content.fixes.length} fixes</span>
                </div>
                <Link to={`/?date=${r.date}`} className="link-sm">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
