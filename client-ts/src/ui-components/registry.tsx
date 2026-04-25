import { ComponentType } from 'react';
import { ColumnMeta, Row } from '@/lib/types';
import Head from './Head';
import BarChart from './BarChart';
import Timeline from './Timeline';

export interface DataComponentProps {
  columns: ColumnMeta[];
  data: Row[];
}

// Add new components here — just one line per component
export const componentRegistry: Record<string, ComponentType<DataComponentProps>> = {
  Head,
  BarChart,
  Timeline,
};
