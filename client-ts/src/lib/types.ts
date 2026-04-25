export type ColumnMeta = { name: string };
export type Row = (string | number | boolean | null)[];
export type UIComponent = 'Head' | 'Aggregate' | 'BarChart' | 'Histogram' | 'PieChart' | 'ScatterPlot' | 'Timeline';

export interface Visualization {
  component: UIComponent;
  columns: ColumnMeta[];
  data: Row[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  visualizations?: Visualization[];
}

export interface ApiRequest {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}

export interface ApiResponse {
  text: string;
  visualizations?: Visualization[];
}
