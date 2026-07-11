import React from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer,
} from "recharts";

function pieColors(th) {
  const base = th.accent;
  return [base, th.muted, "#E8A44C", "#E5637A", "#8B7BE8", "#3FB8AF"];
}

export default function Chart({ s, th, scale = 1 }) {
  const common = { data: s.data, margin: { top: 8, right: 8, bottom: 8, left: 8 } };
  const axisX = <XAxis dataKey="name" tick={{ fill: th.muted, fontSize: 14 * scale }} axisLine={{ stroke: th.rule }} tickLine={false} />;
  const axisY = <YAxis tick={{ fill: th.muted, fontSize: 13 * scale }} axisLine={false} tickLine={false} width={38} />;

  return (
    <div style={{ width: "100%", height: 280 * scale }}>
      <ResponsiveContainer width="100%" height="100%">
        {s.type === "chart.bar" ? (
          <BarChart {...common}>
            {axisX}{axisY}
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {s.data.map((_, i) => <Cell key={i} fill={th.accent} fillOpacity={0.5 + 0.5 * ((i + 1) / s.data.length)} />)}
            </Bar>
          </BarChart>
        ) : s.type === "chart.line" ? (
          <LineChart {...common}>
            {axisX}{axisY}
            <Line type="monotone" dataKey="value" stroke={th.accent} strokeWidth={3} dot={{ r: 3, fill: th.accent }} />
          </LineChart>
        ) : s.type === "chart.area" ? (
          <AreaChart {...common}>
            <defs>
              <linearGradient id="slgArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={th.accent} stopOpacity={0.5} />
                <stop offset="100%" stopColor={th.accent} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {axisX}{axisY}
            <Area type="monotone" dataKey="value" stroke={th.accent} strokeWidth={2.5} fill="url(#slgArea)" />
          </AreaChart>
        ) : (
          <PieChart>
            <Pie data={s.data} dataKey="value" nameKey="name" innerRadius={50 * scale} outerRadius={100 * scale} paddingAngle={2}>
              {s.data.map((_, i) => <Cell key={i} fill={pieColors(th)[i % 6]} />)}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
