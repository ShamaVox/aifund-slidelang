import React from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer,
} from "recharts";

function pieColors(th) {
  return [th.accent, th.muted, "#E8A44C", "#E5637A", "#8B7BE8", "#3FB8AF"];
}

export default function Chart({ s, th, scale = 1 }) {
  const common = { data: s.data, margin: { top: 18, right: 10, bottom: 4, left: 4 } };
  const grid = <CartesianGrid vertical={false} stroke={th.rule} strokeDasharray="3 3" opacity={0.5} />;
  const axisX = <XAxis dataKey="name" tick={{ fill: th.muted, fontSize: 13 * scale, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={{ stroke: th.rule }} tickLine={false} dy={4} />;
  const axisY = <YAxis tick={{ fill: th.muted, fontSize: 12 * scale, fontFamily: "'IBM Plex Mono', monospace" }} axisLine={false} tickLine={false} width={34} />;
  const labelStyle = { fill: th.fg, fontSize: 13 * scale, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 };

  return (
    <div style={{ width: "100%", height: 264 * scale }}>
      <ResponsiveContainer width="100%" height="100%">
        {s.type === "chart.bar" ? (
          <BarChart {...common}>
            {grid}{axisX}{axisY}
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64 * scale}>
              <LabelList dataKey="value" position="top" style={labelStyle} />
              {s.data.map((_, i) => <Cell key={i} fill={th.accent} fillOpacity={0.55 + 0.45 * ((i + 1) / s.data.length)} />)}
            </Bar>
          </BarChart>
        ) : s.type === "chart.line" ? (
          <LineChart {...common}>
            {grid}{axisX}{axisY}
            <Line type="monotone" dataKey="value" stroke={th.accent} strokeWidth={3} dot={{ r: 4, fill: th.bg, stroke: th.accent, strokeWidth: 2 }} activeDot={{ r: 5 }}>
              <LabelList dataKey="value" position="top" style={labelStyle} />
            </Line>
          </LineChart>
        ) : s.type === "chart.area" ? (
          <AreaChart {...common}>
            <defs>
              <linearGradient id="slgArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={th.accent} stopOpacity={0.45} />
                <stop offset="100%" stopColor={th.accent} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            {grid}{axisX}{axisY}
            <Area type="monotone" dataKey="value" stroke={th.accent} strokeWidth={2.5} fill="url(#slgArea)" dot={{ r: 3, fill: th.accent }} />
          </AreaChart>
        ) : (
          <PieChart>
            <Pie data={s.data} dataKey="value" nameKey="name" innerRadius={54 * scale} outerRadius={98 * scale} paddingAngle={3} stroke={th.bg} strokeWidth={2}>
              {s.data.map((_, i) => <Cell key={i} fill={pieColors(th)[i % 6]} />)}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
