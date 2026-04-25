'use client';

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieLabelRenderProps,
} from 'recharts';
import { ColumnMeta, Row } from '@/lib/types';

interface PieChartProps {
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
  '#84cc16',
  '#a78bfa',
];

const RADIAN = Math.PI / 180;
function renderLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (
    typeof cx !== 'number' || typeof cy !== 'number' ||
    typeof midAngle !== 'number' || typeof innerRadius !== 'number' ||
    typeof outerRadius !== 'number' || typeof percent !== 'number'
  ) return null;
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

export default function PieChart({ columns, data }: PieChartProps) {
  if (columns.length < 2 || !data.length) {
    return <p className="text-sm text-gray-500 italic">No data to display.</p>;
  }

  // First column = slice labels, second column = values
  const labelCol = columns[0].name;
  const valueCol = columns[1].name;

  const chartData = data
    .map((row) => ({ name: String(row[0] ?? ''), value: Number(row[1]) }))
    .filter((d) => !isNaN(d.value) && d.value > 0);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-full mt-3">
      <ResponsiveContainer width="100%" height={320}>
        <RechartsPieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={120}
            labelLine={false}
            label={renderLabel}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) =>
              typeof v === 'number'
                ? [`${v.toLocaleString()} (${((v / total) * 100).toFixed(1)}%)`, valueCol]
                : [v, valueCol]
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => <span className="text-gray-700">{value}</span>}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 text-right mt-1">
        {labelCol} · {valueCol}
      </p>
    </div>
  );
}
