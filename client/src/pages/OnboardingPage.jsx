import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Button, Card, Field } from '../components/ui.jsx';
import { inToCm, numOrNull } from '../utils/format.js';
import { addDays, todayIso } from '../utils/dates.js';

/** First-run setup: baseline, goals and daily targets. */
export default function OnboardingPage() {
  const { user, saveProfile } = useAuth();
  const navigate = useNavigate();
  const p = user.profile;
  const [f, setF] = useState({
    age: p.age ?? '',
    heightCm: p.heightCm ?? '',
    startDate: p.schedule?.cycleStart ?? todayIso(),
    weightKg: p.baseline?.weightKg ?? '',
    bodyFatPct: p.baseline?.bodyFatPct ?? '',
    waistIn: '',
    bellyIn: '',
    targetWeightMinKg: '',
    targetWeightMaxKg: '',
    targetDate: addDays(todayIso(), 28),
    kcal: p.targets.kcal,
    proteinG: p.targets.proteinG,
    waterL: p.targets.waterMl / 1000,
    dietNotes: p.dietNotes ?? '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const waistCm = inToCm(f.waistIn);
    const bellyCm = inToCm(f.bellyIn);
    try {
      await saveProfile({
        profile: {
          age: numOrNull(f.age),
          heightCm: numOrNull(f.heightCm),
          dietNotes: f.dietNotes,
          startDate: f.startDate,
          baseline: { weightKg: numOrNull(f.weightKg), bodyFatPct: numOrNull(f.bodyFatPct), waistCm, bellyCm },
          goals: {
            targetDate: f.targetDate || null,
            targetWeightMinKg: numOrNull(f.targetWeightMinKg),
            targetWeightMaxKg: numOrNull(f.targetWeightMaxKg),
          },
          targets: { kcal: numOrNull(f.kcal), proteinG: numOrNull(f.proteinG), waterMl: Math.round(Number(f.waterL) * 1000) },
          schedule: { cycleStart: f.startDate },
          onboarded: true,
        },
      });
      // Record the baseline as the first weigh-in and first tape measurement
      if (f.weightKg) await api.put(`/daily/${f.startDate}`, { weightKg: Number(f.weightKg) });
      if (waistCm || bellyCm) await api.post('/measurements', { date: f.startDate, waistCm, bellyCm, bodyFatPct: numOrNull(f.bodyFatPct) });
      navigate('/', { replace: true });
    } catch (err) {
      const fields = Object.fromEntries(Object.entries(err.fields ?? {}).map(([k, v]) => [k.split('.').pop(), v]));
      setErrors({ ...fields, _form: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="onboarding" id="main">
      <h1>Hi {user.name}, let’s set your baseline</h1>
      <p className="muted">Your coach uses these to judge progress. You can change them later in Settings.</p>
      <form onSubmit={submit} className="stack">
        <Card title="About you">
          <div className="grid-3">
            <Field label="Age" type="number" inputMode="numeric" value={f.age} onChange={set('age')} error={errors.age} />
            <Field label="Height" suffix="cm" type="number" inputMode="decimal" value={f.heightCm} onChange={set('heightCm')} error={errors.heightCm} />
            <Field label="Plan start date" type="date" value={f.startDate} onChange={set('startDate')} hint="Day 1 of your training cycle" />
          </div>
          <Field label="Diet notes" value={f.dietNotes} onChange={set('dietNotes')} placeholder="e.g. Vegetarian, no brinjal" />
        </Card>
        <Card title="Starting point">
          <div className="grid-2">
            <Field label="Weight" suffix="kg" type="number" step="0.05" inputMode="decimal" value={f.weightKg} onChange={set('weightKg')} error={errors.weightKg} />
            <Field label="Body fat" suffix="%" type="number" step="0.1" inputMode="decimal" value={f.bodyFatPct} onChange={set('bodyFatPct')} error={errors.bodyFatPct} />
            <Field label="Waist" suffix="in" type="number" step="0.1" inputMode="decimal" value={f.waistIn} onChange={set('waistIn')} hint={f.waistIn ? `${inToCm(f.waistIn)} cm` : 'At the navel'} error={errors.waistCm} />
            <Field label="Belly" suffix="in" type="number" step="0.1" inputMode="decimal" value={f.bellyIn} onChange={set('bellyIn')} hint={f.bellyIn ? `${inToCm(f.bellyIn)} cm` : 'Widest point'} error={errors.bellyCm} />
          </div>
        </Card>
        <Card title="First goal">
          <div className="grid-3">
            <Field label="Target weight from" suffix="kg" type="number" step="0.1" value={f.targetWeightMinKg} onChange={set('targetWeightMinKg')} />
            <Field label="Target weight to" suffix="kg" type="number" step="0.1" value={f.targetWeightMaxKg} onChange={set('targetWeightMaxKg')} />
            <Field label="By" type="date" value={f.targetDate} onChange={set('targetDate')} hint="Just a checkpoint: tracking continues after it" />
          </div>
        </Card>
        <Card title="Daily targets">
          <div className="grid-3">
            <Field label="Calories" suffix="kcal" type="number" value={f.kcal} onChange={set('kcal')} error={errors.kcal} hint="Never below 1,700 without medical advice" />
            <Field label="Protein" suffix="g" type="number" value={f.proteinG} onChange={set('proteinG')} error={errors.proteinG} />
            <Field label="Water" suffix="L" type="number" step="0.25" value={f.waterL} onChange={set('waterL')} error={errors.waterMl} />
          </div>
        </Card>
        {errors._form && <p className="form-error" role="alert">{errors._form}</p>}
        <Button type="submit" busy={busy} className="btn-block">
          Start my plan
        </Button>
      </form>
    </main>
  );
}
