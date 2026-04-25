'use client';

import { ColumnMeta, Row } from '@/lib/types';

interface AggregateProps {
  columns: ColumnMeta[];
  data: Row[];
}

// Detect the display format from the column name
function detectFormat(name: string): 'currency' | 'percent' | 'number' {
  const lower = name.toLowerCase();
  if (/\$|price|amount|revenue|balance|value|cost|fee|salary|earning|payment/.test(lower)) return 'currency';
  if (/%|percent|rate|ratio|share|proportion/.test(lower)) return 'percent';
  return 'number';
}

function formatValue(raw: string | number | boolean | null, format: 'currency' | 'percent' | 'number'): string {
  const n = Number(raw);
  if (isNaN(n)) return String(raw ?? '—');
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
    case 'percent':
      return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(n / 100);
    default:
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n);
  }
}

// Clean up snake_case / ALL_CAPS column names into readable labels
function humanise(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Aggregate({ columns, data }: AggregateProps) {
  if (!columns.length || !data.length) {
    return <p className="text-sm text-gray-500 italic">No data to display.</p>;
  }

  // Each column in the first row becomes one stat card
  const row = data[0];

  return (
    <div className="w-full mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {columns.map((col, i) => {
        const format = detectFormat(col.name);
        const formatted = formatValue(row[i], format);
        return (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm flex flex-col gap-1"
          >
            <span className="text-2xl font-semibold text-gray-900 leading-tight truncate">
              {formatted}
            </span>
            <span className="text-xs text-gray-500 leading-snug">{humanise(col.name)}</span>
          </div>
        );
      })}
    </div>
  );
}
