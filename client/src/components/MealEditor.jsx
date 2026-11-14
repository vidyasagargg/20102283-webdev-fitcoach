import { useState } from 'react';
import { api } from '../api/client.js';
import { Button, Field } from './ui.jsx';
import Icon from './Icon.jsx';

export const SLOTS = [
  { value: 'pre-workout', label: 'Pre-workout' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'bedtime', label: 'Bedtime' },
  { value: 'other', label: 'Something else' },
];
const NUTRIENTS = [
  ['kcal', 'kcal'],
  ['protein', 'Protein g'],
  ['carbs', 'Carbs g'],
  ['fat', 'Fat g'],
  ['fibre', 'Fibre g'],
  ['sugar', 'Sugar g'],
];
const SOURCE_LABEL = { local: 'Indian food table', usda: 'USDA', manual: 'You entered', unknown: 'Not found: add values' };
const r1 = (n) => Math.round(n * 10) / 10;

/** Describe a meal in words, get an editable nutrition breakdown, then save. */
export default function MealEditor({ initial, onSave, onCancel, busy }) {
  const [m, setM] = useState(initial);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState(null);

  async function estimate() {
    setEstimating(true);
    setError(null);
    try {
      const r = await api.post('/meals/estimate', { text: m.description });
      setM((s) => ({ ...s, items: r.items }));
    } catch (e) {
      setError(e.fields?.text ?? e.message);
    } finally {
      setEstimating(false);
    }
  }

  /** Changing grams rescales that item's nutrients proportionally. */
  function setGrams(i, value) {
    setM((s) => {
      const items = [...s.items];
      const it = { ...items[i] };
      const old = Number(it.grams) || 0;
      const next = Number(value) || 0;
      if (old > 0 && next > 0) for (const [k] of NUTRIENTS) it[k] = r1((it[k] * next) / old);
      it.grams = value;
      items[i] = it;
      return { ...s, items };
    });
  }
  const setItem = (i, patch) => setM((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, ...patch, source: patch.name === undefined && it.source === 'unknown' ? 'manual' : it.source } : it)) }));
  const total = (k) => r1(m.items.reduce((a, it) => a + (Number(it[k]) || 0), 0));

  function submit(e) {
    e.preventDefault();
    const items = m.items.map((it) => ({
      ...Object.fromEntries(Object.entries(it).filter(([k]) => ['name', 'qty', 'unit', 'grams', 'source', ...NUTRIENTS.map((n) => n[0])].includes(k))),
      grams: it.grams === '' ? null : Number(it.grams),
      ...Object.fromEntries(NUTRIENTS.map(([k]) => [k, Number(it[k]) || 0])),
    }));
    onSave({ date: m.date, time: m.time, slot: m.slot, description: m.description, items });
  }

  return (
    <form onSubmit={submit} className="stack-sm">
      <div className="grid-3">
        <Field label="Meal" as="select" value={m.slot} onChange={(e) => setM({ ...m, slot: e.target.value })}>
          {SLOTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Field>
        <Field label="Time" type="time" value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} />
        <Field label="Date" type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
      </div>
      <Field
        label="What did you eat?"
        as="textarea"
        rows={3}
        value={m.description}
        onChange={(e) => setM({ ...m, description: e.target.value })}
        placeholder="2 rotis, 100 g paneer bhurji, 1 bowl dal, salad"
        hint="Add quantities: 2 rotis, 150 g curd, 1 bowl rice, 1 scoop whey."
        error={error}
      />
      <Button type="button" variant="secondary" icon="spark" onClick={estimate} busy={estimating} disabled={!m.description.trim()}>
        {m.items.length ? 'Re-calculate from text' : 'Calculate nutrition'}
      </Button>

      {m.items.length > 0 && (
        <div className="table-wrap">
          <table className="table items-table">
            <thead>
              <tr>
                <th scope="col">Food</th>
                <th scope="col">g</th>
                {NUTRIENTS.map(([k, l]) => (
                  <th key={k} scope="col">{l}</th>
                ))}
                <th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {m.items.map((it, i) => (
                <tr key={i} className={it.source === 'unknown' ? 'row-warn' : ''}>
                  <td>
                    <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} aria-label="Food name" />
                    <span className="muted tiny">{SOURCE_LABEL[it.source] ?? it.source}</span>
                  </td>
                  <td>
                    <input type="number" value={it.grams ?? ''} onChange={(e) => setGrams(i, e.target.value)} aria-label={`${it.name} grams`} />
                  </td>
                  {NUTRIENTS.map(([k, l]) => (
                    <td key={k}>
                      <input type="number" step="0.1" value={it[k] ?? 0} onChange={(e) => setItem(i, { [k]: e.target.value })} aria-label={`${it.name} ${l}`} />
                    </td>
                  ))}
                  <td>
                    <button type="button" className="icon-btn" onClick={() => setM((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }))} aria-label={`Remove ${it.name}`}>
                      <Icon name="close" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td />
                {NUTRIENTS.map(([k]) => (
                  <td key={k}>
                    <strong>{total(k)}</strong>
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <button
        type="button"
        className="link-btn"
        onClick={() => setM((s) => ({ ...s, items: [...s.items, { name: 'Food', grams: 100, source: 'manual', kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0 }] }))}
      >
        + Add an item by hand
      </button>
      <p className="muted small">Estimates come from an Indian food table and the USDA database. Adjust anything that looks off.</p>
      <div className="btn-row">
        <Button type="submit" busy={busy} icon="check" disabled={!m.description.trim() && !m.items.length}>
          Save meal
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
