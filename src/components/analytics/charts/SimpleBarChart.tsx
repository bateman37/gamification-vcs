"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ANALYTICS_COLORS } from "../colors";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/** Barras horizontales con referencia cero (parte J4): usadas para resumen por KPI y distribucion. */
export function SimpleBarChart({
  data,
  height = 260,
  layout = "horizontal",
  valueSuffix = "",
}: {
  data: BarDatum[];
  height?: number;
  layout?: "horizontal" | "vertical";
  /** Sufijo textual del valor en el tooltip (p. ej. " personas"). Las funciones no pueden cruzar
   * el limite servidor/cliente, por eso este componente no acepta un formateador arbitrario. */
  valueSuffix?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-text-muted">Sin datos suficientes para esta gráfica.</p>;
  }
  const isVertical = layout === "vertical";
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={isVertical ? "vertical" : "horizontal"} margin={{ top: 8, right: 24, left: isVertical ? 96 : -8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ANALYTICS_COLORS.border} />
          {isVertical ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={120} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis type="number" tick={{ fontSize: 11 }} />
            </>
          )}
          <Tooltip formatter={(value: number) => `${value}${valueSuffix}`} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="value">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color ?? ANALYTICS_COLORS.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
