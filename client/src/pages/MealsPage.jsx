import { useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { Button, Card, Empty, ErrorState, Loader, ProgressBar, Sheet } from '../components/ui.jsx';
import MealEditor, { SLOTS } from '../components/MealEditor.jsx';
import Icon from '../components/Icon.jsx';
import { nowTime } from '../utils/dates.js';
import { num } from '../utils/format.js';

const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.value, s.label]));
const SLOT_TIME = { 'pre-workout': '06:30', breakfast: '09:00', lunch: '13:15', snack: '17:00', dinner: '20:30', bedtime: '22:30', other: null };

export default function MealsPage() {
  const { user } = useAuth();
  const { date, toast } = useUi();
  const { data: meals, error, loading, reload } = useApi(`/meals?date=${date}`);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const t = user.profile.targets;

  if (loading && !meals) return <Loader label="Loading meals" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const totals = (meals ?? []).reduce(
    (a, m) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + (m.totals?.[k] ?? 0)])),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0 },
  );
  const rows = [
    ['Calories', totals.kcal, t.kcal, 'kcal', 'orange'],
    ['Protein', totals.protein, t.proteinG, 'g', 'green'],
    ['Carbs', totals.carbs, t.carbsG, 'g', 'blue'],
    ['Fat', totals.fat, t.fatG, 'g', 'violet'],
    ['Fibre', totals.fibre, t.fibreG, 'g', 'green'],
    ['Sugar', totals.sugar, t.sugarMaxG, 'g max', 'warn'],
  ];

  const openNew = (slot = 'other') => setEditing({ date, time: nowTime(), slot, description: '', items: [] });

  async function save(body) {
    setBusy(true);
    try {
      if (editing.id) await api.put(`/meals/${editing.id}`, body);
      else await api.post('/meals', body);
      toast(editing.id ? 'Meal updated' : 'Meal logged', 'success');
      setEditing(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(m) {
    if (!window.confirm(`Delete this ${SLOT_LABEL[m.slot].toLowerCase()} entry?`)) return;
    try {
      await api.del(`/meals/${m.id}`);
      toast('Meal deleted', 'success');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const proteinLeft = Math.max(0, Math.round(t.proteinG - totals.protein));
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Nutrition</p>
          <h1>Meals</h1>
        </div>
        <Button icon="plus" onClick={() => openNew()}>
          Log food
        </Button>
      </div>

      <Card className="macro-card">
        <div className="macro-grid">
          {rows.map(([label, v, target, unit, tone]) => {
            const over = label === 'Sugar' ? v > target : label === 'Calories' && v > target * 1.05;
            return (
              <div key={label} className="macro">
                <div className="macro-top">
                  <span>{label}</span>
                  <span className={over ? 'text-bad' : 'muted'}>
                    <strong>{num(v)}</strong> / {num(target)} {unit}
                  </span>
                </div>
                <ProgressBar value={v} max={target} label={`${label} progress`} tone={over ? 'bad' : tone} />
              </div>
            );
          })}
        </div>
        <p className="muted small">{proteinLeft > 0 ? `${proteinLeft} g protein to go. Paneer, tofu, soya chunks, curd or whey will close it.` : 'Protein target hit. Nice work.'}</p>
      </Card>

      <div className="meal-slots">
        {SLOTS.map((slot) => {
          const items = (meals ?? []).filter((m) => m.slot === slot.value);
          if (slot.value === 'other' && !items.length) return null;
          return (
            <Card
              key={slot.value}
              title={slot.label}
              action={<span className="muted small">{SLOT_TIME[slot.value] ?? ''}</span>}
              className={items.length ? 'meal-done' : ''}
            >
              {items.length === 0 ? (
                <button className="meal-add" onClick={() => setEditing({ date, time: SLOT_TIME[slot.value] ?? nowTime(), slot: slot.value, description: '', items: [] })}>
                  <Icon name="plus" size={18} /> Log {slot.label.toLowerCase()}
                </button>
              ) : (
                items.map((m) => (
                  <div key={m.id} className="meal-entry">
                    <div>
                      <p>{m.description || m.items.map((i) => i.name).join(', ')}</p>
                      <p className="muted small">
                        {m.time} · {num(m.totals.kcal)} kcal · {num(m.totals.protein, 1)} g protein · {num(m.totals.fibre, 1)} g fibre
                      </p>
                    </div>
                    <div className="btn-row tight">
                      <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(m)} aria-label="Edit meal" />
                      <Button variant="ghost" size="sm" icon="trash" onClick={() => remove(m)} aria-label="Delete meal" />
                    </div>
                  </div>
                ))
              )}
            </Card>
          );
        })}
      </div>
      {(meals ?? []).length === 0 && <Empty icon="meals" title="Nothing logged yet today">Tap a meal above or “Log food” and type what you ate.</Empty>}

      <Sheet open={Boolean(editing)} title={editing?.id ? 'Edit meal' : 'Log food'} onClose={() => setEditing(null)} wide>
        {editing && <MealEditor initial={editing} onSave={save} onCancel={() => setEditing(null)} busy={busy} />}
      </Sheet>
    </div>
  );
}
