'use client';

import { ColumnMeta, Row } from '@/lib/types';

interface HeadProps {
  columns: ColumnMeta[];
  data: Row[];
}

const DISPLAY_LIMIT = 10;

export default function Head({ columns, data }: HeadProps) {
  const displayRows = data.slice(0, DISPLAY_LIMIT);

  return (
    <div className="w-full mt-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                >
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {displayRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-blue-50 transition-colors duration-100"
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-xs truncate"
                    title={cell !== null && cell !== undefined ? String(cell) : ''}
                  >
                    {cell === null || cell === undefined ? (
                      <span className="text-gray-400 italic">null</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > DISPLAY_LIMIT && (
        <p className="mt-2 text-xs text-gray-500 text-right">
          Showing {DISPLAY_LIMIT} of {data.length} rows
        </p>
      )}
    </div>
  );
}
