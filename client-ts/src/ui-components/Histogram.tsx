'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ColumnMeta, Row } from '@/lib/types';

interface HistogramProps {
  columns: ColumnMeta[];
  data: Row[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Build histogram bins from raw values
function buildBins(values: number[], binCount: number): { label: string; count: number }[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ label: String(min), count: values.length }];

  const width = (max - min) / binCount;
  const bins: { label: string; count: number }[] = Array.from({ length: binCount }, (_, i) => {
    const lo = min + i * width;
    const hi = lo + width;
    return {
      label: `${lo.toLocaleString(undefined, { maximumFractionDigits: 2 })}–${hi.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      count: 0,
    };
  });

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), binCount - 1);
    bins[idx].count++;
  }
  return bins;
}

// Expected query shapes:
//   One column  → histogram of that column's values (each row is one observation)
//   Two columns → first col is pre-bucketed label, second is frequency count

export default function Histogram({ columns, data }: HistogramProps) {
  if (!columns.length || !data.length) {
    return <p className="text-sm text-gray-500 italic">No data to display.</p>;
  }

  // Detect pre-bucketed vs raw values
  const isPreBucketed =
    columns.length >= 2 && data.every((row) => !isNaN(Number(row[1])));

  const valueCols = isPreBucketed ? columns.slice(1) : columns;

  const datasets = valueCols.map((col, colIdx) => {
    const srcIdx = isPreBucketed ? colIdx + 1 : colIdx;
    const values = data.map((row) => Number(row[srcIdx])).filter((v) => !isNaN(v));

    if (isPreBucketed) {
      // Use provided labels from column 0
      return {
        name: col.name,
        bins: data.map((row) => ({ label: String(row[0]), count: Number(row[srcIdx]) })),
      };
    }

    const binCount = Math.min(Math.ceil(Math.sqrt(values.length)), 30);
    return { name: col.name, bins: buildBins(values, binCount) };
  });

  const primaryBins = datasets[0].bins;
  const chartData = primaryBins.map((bin, i) => {
    const obj: Record<string, string | number> = { label: bin.label };
    datasets.forEach((ds) => {
      obj[ds.name] = ds.bins[i]?.count ?? 0;
    });
    return obj;
  });

  const singleSeries = datasets.length === 1;

  return (
    <div className="w-full mt-3">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip formatter={(v) => (typeof v === 'number' ? v.toLocaleString() : v)} />
          {datasets.map((ds, i) => (
            <Bar
              key={ds.name}
              dataKey={ds.name}
              fill={COLORS[i % COLORS.length]}
              name={singleSeries ? 'Count' : ds.name}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
