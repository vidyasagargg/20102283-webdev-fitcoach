/**
 * Chart components (Recharts). One measure per chart, never two y-axes.
 * Thin marks, recessive grid, hover tooltips, and a table toggle for
 * screen-reader and keyboard users.
 */
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtShort } from '../utils/dates.js';

const axis = { stroke: 'var(--chart-axis)', fontSize: 12, tickLine: false };
const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)' },
  labelStyle: { color: 'var(--text-2)', marginBottom: 4 },
};

function ChartFrame({ title, summary, legend, table, children, height = 240 }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        <button className="link-btn small" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </figcaption>
      {summary && <p className="chart-summary">{summary}</p>}
      {legend && <p className="legend">{legend}</p>}
      {showTable ? (
        <div className="table-wrap chart-table">{table}</div>
      ) : (
        <div style={{ width: '100%', height }} aria-hidden="true">
          <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

const SimpleTable = ({ rows, cols }) => (
  <table className="table">
    <thead>
      <tr>
        {cols.map((c) => (
          <th key={c.key} scope="col">{c.label}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          {cols.map((c) => (
            <td key={c.key}>{c.fmt ? c.fmt(r[c.key]) : r[c.key] ?? '–'}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export function WeightChart({ data, goalMin, goalMax, goalDate, summary }) {
  const values = data.flatMap((d) => [d.weightKg, d.avg7]).filter((v) => v != null);
  const lo = Math.floor(Math.min(...values, goalMin ?? Infinity) - 0.5);
  const hi = Math.ceil(Math.max(...values, goalMax ?? -Infinity) + 0.5);
  const inRange = goalDate && data.length && goalDate >= data[0].date && goalDate <= data.at(-1).date;
  return (
    <ChartFrame
      title="Weight (kg)"
      summary={summary}
      height={260}
      table={<SimpleTable rows={data.filter((d) => d.weightKg != null)} cols={[{ key: 'date', label: 'Date', fmt: fmtShort }, { key: 'weightKg', label: 'Weight kg' }, { key: 'avg7', label: '7-day avg' }]} />}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShort} {...axis} minTickGap={28} />
        <YAxis domain={[lo, hi]} {...axis} width={44} />
        {goalMin != null && goalMax != null && (
          <ReferenceArea y1={goalMin} y2={goalMax} fill="var(--chart-band)" fillOpacity={1} stroke="none" ifOverflow="extendDomain" />
        )}
        {inRange && <ReferenceLine x={goalDate} stroke="var(--text-3)" strokeDasharray="4 4" label={{ value: 'Goal date', position: 'insideTopRight', fill: 'var(--text-2)', fontSize: 11 }} />}
        <Tooltip {...tooltipStyle} labelFormatter={fmtShort} formatter={(v, n) => [v == null ? '–' : `${v} kg`, n === 'avg7' ? '7-day average' : 'Weigh-in']} />
        <Scatter dataKey="weightKg" fill="var(--chart-dot)" r={3} isAnimationActive={false} />
        <Line dataKey="avg7" stroke="var(--series-1)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
      </ComposedChart>
    </ChartFrame>
  );
}

export function DailyBarChart({ title, data, dataKey, target, unit, summary, color = 'var(--series-1)' }) {
  return (
    <ChartFrame
      title={title}
      summary={summary}
      legend={target ? <><span className="legend-target" /> Daily target: {target} {unit}</> : null}
      height={200}
      table={<SimpleTable rows={data.filter((d) => d[dataKey] != null)} cols={[{ key: 'date', label: 'Date', fmt: fmtShort }, { key: dataKey, label: `${title} (${unit})` }]} />}
    >
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }} barCategoryGap="20%">
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShort} {...axis} minTickGap={28} />
        <YAxis {...axis} width={48} />
        <Tooltip {...tooltipStyle} labelFormatter={fmtShort} formatter={(v) => [`${v ?? '–'} ${unit}`, title]} cursor={{ fill: 'var(--chart-band)' }} />
        {target && <ReferenceLine y={target} stroke="var(--text)" strokeWidth={1.5} strokeDasharray="5 4" ifOverflow="extendDomain" />}
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  );
}

export function LiftChart({ name, data }) {
  return (
    <ChartFrame
      title={`${name}: ${data.at(-1)?.assisted ? 'assistance on the best set (kg, lower is better)' : 'top working set (kg)'}`}
      height={220}
      table={<SimpleTable rows={data} cols={[{ key: 'date', label: 'Date', fmt: fmtShort }, { key: 'weightKg', label: 'kg' }, { key: 'reps', label: 'Reps' }, { key: 'e1rm', label: 'Est. 1RM' }]} />}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtShort} {...axis} minTickGap={28} />
        <YAxis {...axis} width={44} domain={['dataMin - 2.5', 'dataMax + 2.5']} />
        <Tooltip {...tooltipStyle} labelFormatter={fmtShort} formatter={(v, n, p) => [`${v} kg × ${p.payload.reps}`, 'Top set']} />
        <Line dataKey="weightKg" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }} type="stepAfter" isAnimationActive={false} />
      </LineChart>
    </ChartFrame>
  );
}
