import { ComponentType } from 'react';
import { ColumnMeta, Row } from '@/lib/types';
import Head from './Head';
import Aggregate from './Aggregate';
import BarChart from './BarChart';
import Histogram from './Histogram';
import PieChart from './PieChart';
import ScatterPlot from './ScatterPlot';
import Timeline from './Timeline';

export interface DataComponentProps {
  columns: ColumnMeta[];
  data: Row[];
}

// Add new components here — just one line per component
export const componentRegistry: Record<string, ComponentType<DataComponentProps>> = {
  Head,
  Aggregate,
  BarChart,
  Histogram,
  PieChart,
  ScatterPlot,
  Timeline,
};
