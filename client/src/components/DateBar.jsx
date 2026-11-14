import { useUi } from '../context/UiContext.jsx';
import { addDays, relativeLabel, todayIso } from '../utils/dates.js';
import Icon from './Icon.jsx';

/** Step through days, or jump to any date. Future days are allowed for planning. */
export default function DateBar() {
  const { date, setDate, isToday } = useUi();
  return (
    <div className="datebar" role="group" aria-label="Choose day">
      <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
        <Icon name="left" />
      </button>
      <label className="datebar-label">
        <span>{relativeLabel(date)}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="Pick a date"
        />
      </label>
      <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
        <Icon name="right" />
      </button>
      {!isToday && (
        <button className="chip" onClick={() => setDate(todayIso())}>
          Today
        </button>
      )}
    </div>
  );
}
