'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ColumnMeta, Row } from '@/lib/types';

interface BarChartProps {
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

export default function BarChart({ columns, data }: BarChartProps) {
  if (!columns.length || !data.length) {
    return <p className="text-sm text-gray-500 italic">No data to display.</p>;
  }

  const labelCol = columns[0].name;
  const seriesCols = columns.slice(1).map((c) => c.name);

  // Build Recharts-friendly array of objects
  const chartData = data.map((row) => {
    const obj: Record<string, string | number | null> = { [labelCol]: row[0] as string };
    seriesCols.forEach((col, i) => {
      const raw = row[i + 1];
      obj[col] = raw !== null && raw !== undefined ? Number(raw) : null;
    });
    return obj;
  });

  // Auto-orient: horizontal when many rows or long labels
  const avgLabelLen =
    chartData.reduce((sum, d) => sum + String(d[labelCol] ?? '').length, 0) / chartData.length;
  const isHorizontal = data.length > 8 || avgLabelLen > 12;

  const singleSeries = seriesCols.length === 1;

  return (
    <div className="w-full mt-3">
      <ResponsiveContainer width="100%" height={Math.max(280, data.length * (isHorizontal ? 28 : 0))}>
        <RechartsBarChart
          data={chartData}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 24, left: isHorizontal ? 100 : 8, bottom: isHorizontal ? 8 : 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
              <YAxis type="category" dataKey={labelCol} tick={{ fontSize: 11 }} width={90} />
            </>
          ) : (
            <>
              <XAxis
                dataKey={labelCol}
                tick={{ fontSize: 11 }}
                angle={avgLabelLen > 8 ? -35 : 0}
                textAnchor={avgLabelLen > 8 ? 'end' : 'middle'}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
            </>
          )}
          <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString() : v} />
          {!singleSeries && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {seriesCols.map((col, i) => (
            <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]}>
              {singleSeries &&
                chartData.map((_, j) => (
                  <Cell key={j} fill={COLORS[j % COLORS.length]} />
                ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
