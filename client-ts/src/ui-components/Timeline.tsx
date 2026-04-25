'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ColumnMeta, Row } from '@/lib/types';

interface TimelineProps {
  columns: ColumnMeta[];
  data: Row[];
}

const COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
];

function formatDate(raw: string | number | boolean | null): string {
  if (raw === null || raw === undefined) return '';
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function Timeline({ columns, data }: TimelineProps) {
  if (!columns.length || !data.length) {
    return <p className="text-sm text-gray-500 italic">No data to display.</p>;
  }

  const dateCol = columns[0].name;
  const seriesCols = columns.slice(1).map((c) => c.name);

  const chartData = data.map((row) => {
    const obj: Record<string, string | number | null> = { [dateCol]: formatDate(row[0]) };
    seriesCols.forEach((col, i) => {
      const raw = row[i + 1];
      obj[col] = raw !== null && raw !== undefined ? Number(raw) : null;
    });
    return obj;
  });

  // Determine tick density — avoid overcrowding
  const maxTicks = 10;
  const tickInterval = Math.max(0, Math.ceil(chartData.length / maxTicks) - 1);

  const singleSeries = seriesCols.length === 1;

  return (
    <div className="w-full mt-3">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey={dateCol}
            tick={{ fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={tickInterval}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
          <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString() : v} />
          {!singleSeries && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {seriesCols.map((col, i) => (
            <Line
              key={col}
              type="monotone"
              dataKey={col}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
