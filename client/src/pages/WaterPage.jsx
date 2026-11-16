import { useState } from 'react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUi } from '../context/UiContext.jsx';
import { Button, Card, Empty, ErrorState, Field, Loader } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { nowTime } from '../utils/dates.js';
import { litres } from '../utils/format.js';

/** Expected intake by now: spread over 06:00–22:00. */
function expectedByNow(target) {
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.round((target * Math.min(1, Math.max(0, (h - 6) / 16))) / 50) * 50;
}

export default function WaterPage() {
  const { user } = useAuth();
  const { date, isToday, toast } = useUi();
  const { data, error, loading, reload } = useApi(`/water?date=${date}`);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(null);
  const target = user.profile.targets.waterMl;

  if (loading && !data) return <Loader label="Loading water" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const entries = data ?? [];
  const total = entries.reduce((a, e) => a + e.ml, 0);
  const fill = Math.min(1, total / target);
  const expected = expectedByNow(target);

  async function add(ml) {
    if (!ml || ml < 1 || ml > 5000) return toast('Enter between 1 and 5,000 ml', 'error');
    setBusy(ml);
    try {
      await api.post('/water', { date, ml: Number(ml), time: nowTime() });
      toast(`+${ml} ml`, 'success');
      setCustom('');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }
  async function remove(id) {
    await api.del(`/water/${id}`).catch((e) => toast(e.message, 'error'));
    reload();
  }

  let pace = null;
  if (isToday) {
    if (total >= target) pace = { tone: 'good', text: 'Target reached. Keep sipping through your shift.' };
    else if (total >= expected) pace = { tone: 'good', text: `On pace: ${litres(expected)} expected by now.` };
    else pace = { tone: 'warn', text: `Behind by ${expected - total} ml. Drink a glass now.` };
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Hydration</p>
          <h1>Water</h1>
        </div>
      </div>
      <div className="grid-main">
        <Card className="water-card">
          <div className="bottle" role="img" aria-label={`${litres(total)} of ${litres(target)}`}>
            <div className="bottle-fill" style={{ height: `${fill * 100}%` }} />
            <div className="bottle-text">
              <strong>{litres(total)}</strong>
              <span>of {litres(target)}</span>
            </div>
          </div>
          {pace && <p className={`pace pace-${pace.tone}`}>{pace.text}</p>}
          <div className="water-buttons">
            {[150, 250, 500, 750].map((ml) => (
              <Button key={ml} variant="secondary" onClick={() => add(ml)} busy={busy === ml}>
                +{ml} ml
              </Button>
            ))}
          </div>
          <form className="inline-form" onSubmit={(e) => (e.preventDefault(), add(Number(custom)))}>
            <Field label="Custom amount" suffix="ml" type="number" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!custom}>
              Add
            </Button>
          </form>
        </Card>
        <Card title="Log">
          {entries.length === 0 ? (
            <Empty icon="water" title="No water logged for this day" />
          ) : (
            <ul className="water-log">
              {[...entries].reverse().map((e) => (
                <li key={e.id}>
                  <Icon name="water" size={18} />
                  <span>{e.ml} ml</span>
                  <span className="muted">{e.time ?? ''}</span>
                  <button className="icon-btn" onClick={() => remove(e.id)} aria-label={`Delete ${e.ml} ml at ${e.time}`}>
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
