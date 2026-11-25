
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { Button, Card, Field } from '../components/ui.jsx';
import { inToCm, numOrNull } from '../utils/format.js';
import { addDays, todayIso } from '../utils/dates.js';

const DEFAULT_TARGETS = {
  kcal: 1900,
  proteinG: 130,
  waterMl: 3000,
};

const safeNumber = (value) => {
  if (value == null || String(value).trim() === '') {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const safeInToCm = (value) => {
  const number = safeNumber(value);

  return number === null ? null : inToCm(number);
};

const safeCmToIn = (value) => {
  const number = safeNumber(value);

  return number === null
    ? ''
    : Number((number / 2.54).toFixed(1));
};

/**
 * First-run setup: baseline, goals and daily targets.
 *
 * Wait until the authenticated user is available
 * before initializing the onboarding form.
 */
export default function OnboardingPage() {
  const { user, saveProfile } = useAuth();

  if (!user) {
    return (
      <main className="onboarding" id="main">
        <p className="muted">Loading your profile...</p>
      </main>
    );
  }

  return (
    <OnboardingForm
      key={user?.id ?? user?.email ?? 'onboarding'}
      user={user}
      saveProfile={saveProfile}
    />
  );
}

function OnboardingForm({ user, saveProfile }) {
  const navigate = useNavigate();

  // Safely read nested backend objects.
  const p = user?.profile ?? {};
  const baseline = p?.baseline ?? {};
  const goals = p?.goals ?? {};
  const targets = p?.targets ?? {};
  const schedule = p?.schedule ?? {};
  const safety = p?.safety ?? {};

  const [f, setF] = useState(() => {
    const today = todayIso();

    const startDate =
      schedule?.cycleStart ||
      p?.startDate ||
      today;

    return {
      age: p?.age ?? '',

      heightCm: p?.heightCm ?? '',

      startDate,

      weightKg: baseline?.weightKg ?? '',

      bodyFatPct: baseline?.bodyFatPct ?? '',

      waistIn: safeCmToIn(baseline?.waistCm),

      bellyIn: safeCmToIn(baseline?.bellyCm),

      targetWeightMinKg:
        goals?.targetWeightMinKg ?? '',

      targetWeightMaxKg:
        goals?.targetWeightMaxKg ?? '',

      targetDate:
        goals?.targetDate || addDays(startDate, 28),

      kcal:
        targets?.kcal ?? DEFAULT_TARGETS.kcal,

      proteinG:
        targets?.proteinG ?? DEFAULT_TARGETS.proteinG,

      waterL:
        (
          safeNumber(targets?.waterMl) ??
          DEFAULT_TARGETS.waterMl
        ) / 1000,

      dietNotes: p?.dietNotes ?? '',
    };
  });

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => {
    const value = event?.target?.value ?? '';

    setF((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setErrors({});

    try {
      const startDate =
        f?.startDate || todayIso();

      const waistCm = safeInToCm(f?.waistIn);
      const bellyCm = safeInToCm(f?.bellyIn);

      const weightKg = safeNumber(f?.weightKg);
      const bodyFatPct = safeNumber(f?.bodyFatPct);

      const waterL = safeNumber(f?.waterL);

      const waterMl =
        waterL === null
          ? DEFAULT_TARGETS.waterMl
          : Math.round(waterL * 1000);

      const profilePayload = {
        age: safeNumber(f?.age),

        heightCm: safeNumber(f?.heightCm),

        dietNotes: f?.dietNotes ?? '',

        startDate,

        baseline: {
          ...baseline,
          weightKg,
          bodyFatPct,
          waistCm,
          bellyCm,
        },

        goals: {
          ...goals,
          targetDate: f?.targetDate || null,

          targetWeightMinKg:
            safeNumber(f?.targetWeightMinKg),

          targetWeightMaxKg:
            safeNumber(f?.targetWeightMaxKg),
        },

        targets: {
          ...targets,

          kcal:
            safeNumber(f?.kcal) ??
            DEFAULT_TARGETS.kcal,

          proteinG:
            safeNumber(f?.proteinG) ??
            DEFAULT_TARGETS.proteinG,

          waterMl,
        },

        schedule: {
          ...schedule,
          cycleStart: startDate,
        },

        onboarded: true,
      };

      await saveProfile({
        profile: profilePayload,
      });

      // Record the baseline as the first weigh-in.
      if (weightKg !== null && weightKg > 0) {
        await api.put(`/daily/${startDate}`, {
          weightKg,
        });
      }

      // Record the first tape measurement.
      if (waistCm !== null || bellyCm !== null) {
        await api.post('/measurements', {
          date: startDate,
          waistCm,
          bellyCm,
          bodyFatPct,
        });
      }

      navigate('/', { replace: true });
    } catch (err) {
      const rawFields =
        err?.fields &&
        typeof err.fields === 'object'
          ? err.fields
          : {};

      const fields = Object.fromEntries(
        Object.entries(rawFields).map(([key, value]) => [
          key.split('.').pop(),
          Array.isArray(value)
            ? value.join(', ')
            : String(value ?? ''),
        ])
      );

      setErrors({
        ...fields,
        _form:
          err?.message ||
          'Unable to save your profile. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="onboarding" id="main">
      <h1>
        Hi {user?.name?.trim() || 'there'},
        let’s set your baseline
      </h1>

      <p className="muted">
        Your coach uses these to judge progress.
        You can change them later in Settings.
      </p>

      <form onSubmit={submit} className="stack">

        {/* About you */}
        <Card title="About you">
          <div className="grid-3">
            <Field
              label="Age"
              type="number"
              inputMode="numeric"
              value={f?.age ?? ''}
              onChange={set('age')}
              error={errors?.age}
            />

            <Field
              label="Height"
              suffix="cm"
              type="number"
              inputMode="decimal"
              value={f?.heightCm ?? ''}
              onChange={set('heightCm')}
              error={errors?.heightCm}
            />

            <Field
              label="Plan start date"
              type="date"
              value={f?.startDate ?? ''}
              onChange={set('startDate')}
              hint="Day 1 of your training cycle"
              error={errors?.startDate}
            />
          </div>

          <Field
            label="Diet notes"
            value={f?.dietNotes ?? ''}
            onChange={set('dietNotes')}
            placeholder="e.g. Vegetarian, no brinjal"
            error={errors?.dietNotes}
          />
        </Card>

        {/* Starting point */}
        <Card title="Starting point">
          <div className="grid-2">
            <Field
              label="Weight"
              suffix="kg"
              type="number"
              step="0.05"
              inputMode="decimal"
              value={f?.weightKg ?? ''}
              onChange={set('weightKg')}
              error={errors?.weightKg}
            />

            <Field
              label="Body fat"
              suffix="%"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={f?.bodyFatPct ?? ''}
              onChange={set('bodyFatPct')}
              error={errors?.bodyFatPct}
            />

            <Field
              label="Waist"
              suffix="in"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={f?.waistIn ?? ''}
              onChange={set('waistIn')}
              hint={
                safeNumber(f?.waistIn) !== null
                  ? `${safeInToCm(f?.waistIn)} cm`
                  : 'At the navel'
              }
              error={errors?.waistCm}
            />

            <Field
              label="Belly"
              suffix="in"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={f?.bellyIn ?? ''}
              onChange={set('bellyIn')}
              hint={
                safeNumber(f?.bellyIn) !== null
                  ? `${safeInToCm(f?.bellyIn)} cm`
                  : 'Widest point'
              }
              error={errors?.bellyCm}
            />
          </div>
        </Card>

        {/* First goal */}
        <Card title="First goal">
          <div className="grid-3">
            <Field
              label="Target weight from"
              suffix="kg"
              type="number"
              step="0.1"
              value={f?.targetWeightMinKg ?? ''}
              onChange={set('targetWeightMinKg')}
              error={errors?.targetWeightMinKg}
            />

            <Field
              label="Target weight to"
              suffix="kg"
              type="number"
              step="0.1"
              value={f?.targetWeightMaxKg ?? ''}
              onChange={set('targetWeightMaxKg')}
              error={errors?.targetWeightMaxKg}
            />

            <Field
              label="By"
              type="date"
              value={f?.targetDate ?? ''}
              onChange={set('targetDate')}
              hint="Just a checkpoint: tracking continues after it"
              error={errors?.targetDate}
            />
          </div>
        </Card>

        {/* Daily targets */}
        <Card title="Daily targets">
          <div className="grid-3">
            <Field
              label="Calories"
              suffix="kcal"
              type="number"
              value={f?.kcal ?? ''}
              onChange={set('kcal')}
              error={errors?.kcal}
              hint={`Never below ${
                safety?.minKcal ?? 1700
              } without medical advice`}
            />

            <Field
              label="Protein"
              suffix="g"
              type="number"
              value={f?.proteinG ?? ''}
              onChange={set('proteinG')}
              error={errors?.proteinG}
            />

            <Field
              label="Water"
              suffix="L"
              type="number"
              step="0.25"
              value={f?.waterL ?? ''}
              onChange={set('waterL')}
              error={errors?.waterMl}
            />
          </div>
        </Card>

        {/* Form-level error */}
        {errors?._form && (
          <p className="form-error" role="alert">
            {errors._form}
          </p>
        )}

        <Button
          type="submit"
          busy={busy}
          disabled={busy}
          className="btn-block"
        >
          {busy ? 'Saving your plan...' : 'Start my plan'}
        </Button>
      </form>
    </main>
  );
}
