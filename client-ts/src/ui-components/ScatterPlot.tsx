'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ColumnMeta, Row } from '@/lib/types';

interface ScatterPlotProps {
  columns: ColumnMeta[];
  data: Row[];
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
];

// Expected query shape:
//   Option A — two columns: x, y  → single dataset
//   Option B — three columns: x, dataset_label, y  → one scatter series per unique label
//   Option C — x, y1, y2, ...  → one series per y column, all sharing x

export default function ScatterPlot({ columns, data }: ScatterPlotProps) {
  if (columns.length < 2 || !data.length) {
    return <p className="text-sm text-gray-500 italic">No data to display.</p>;
  }

  const [xCol, ...rest] = columns;

  // Option B: exactly 3 cols where middle col is non-numeric (categorical label)
  const isGrouped =
    rest.length === 2 &&
    data.some((row) => typeof row[1] === 'string' && isNaN(Number(row[1])));

  let series: { name: string; points: { x: number; y: number }[] }[] = [];

  if (isGrouped) {
    // Group by the label column (index 1)
    const yCol = columns[2].name;
    const groups: Record<string, { x: number; y: number }[]> = {};
    for (const row of data) {
      const x = Number(row[0]);
      const label = String(row[1]);
      const y = Number(row[2]);
      if (!groups[label]) groups[label] = [];
      groups[label].push({ x, y });
    }
    series = Object.entries(groups).map(([name, points]) => ({ name, points }));
    void yCol;
  } else {
    // One series per y column
    series = rest.map((col, i) => ({
      name: col.name,
      points: data.map((row) => ({ x: Number(row[0]), y: Number(row[i + 1]) })),
    }));
  }

  return (
    <div className="w-full mt-3">
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 8, right: 24, left: 8, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            dataKey="x"
            name={xCol.name}
            tick={{ fontSize: 11 }}
            label={{ value: xCol.name, position: 'insideBottom', offset: -16, fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(v) => (typeof v === 'number' ? v.toLocaleString() : v)}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Scatter
              key={s.name}
              name={s.name}
              data={s.points}
              fill={COLORS[i % COLORS.length]}
              opacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
