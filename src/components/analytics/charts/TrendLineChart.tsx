"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ANALYTICS_COLORS } from "../colors";

export interface TrendSeriesDef {
  key: string;
  name: string;
  color: string;
}

export interface TrendPoint {
  label: string;
  [seriesKey: string]: number | string | null;
}

/**
 * Linea temporal con huecos reales (parte H4/J4): `connectNulls={false}` para
 * que una semana sin dato/excluida se vea como un hueco, nunca interpolada
 * ni convertida en cero.
 */
export function TrendLineChart({ data, series, height = 288 }: { data: TrendPoint[]; series: TrendSeriesDef[]; height?: number }) {
  if (data.length === 0) {
    return <p className="text-sm text-text-muted">Sin datos suficientes para esta gráfica.</p>;
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.border} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12 }} formatter={(value: number | string) => (typeof value === "number" ? Math.round(value * 100) / 100 : value)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} connectNulls={false} dot={{ r: 2 }} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
