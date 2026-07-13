import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, PageBody } from "./_shared";
import { Card } from "@/components/ui/card";
import { Boxes, Package, AlertTriangle, PackageX, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#1E1B4B", "#2563EB", "#EA580C", "#16A34A", "#DC2626", "#0284C7", "#7C3AED"];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [progs, setProgs] = useState([]);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      api.get("/reports/dashboard"),
      api.get("/reports/program-consumption"),
    ]);
    setStats(s.data);
    setProgs(p.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: "Total Balance", value: stats?.total_balance ?? "—", icon: Boxes, color: "text-indigo-950", testid: "stat-balance" },
    { label: "Master Items", value: stats?.total_items ?? "—", icon: Package, color: "text-sky-700", testid: "stat-items" },
    { label: "Short Expiry", value: stats?.short_expiry_count ?? "—", icon: AlertTriangle, color: "text-amber-600", testid: "stat-short" },
    { label: "Low Stock", value: stats?.low_stock_count ?? "—", icon: TrendingUp, color: "text-orange-600", testid: "stat-low" },
    { label: "NIL Stock", value: stats?.nil_stock_count ?? "—", icon: PackageX, color: "text-red-600", testid: "stat-nil" },
  ];

  const deptChart = stats
    ? Object.entries(stats.dept_balance).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <>
      <PageHeader title="Overview" subtitle="Program-wise consumption and stock health at a glance" />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="dashboard-stats">
          {cards.map((c) => (
            <Card key={c.label} className="p-4" data-testid={c.testid}>
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-slate-500">{c.label}</div>
                <c.icon size={16} className={c.color} />
              </div>
              <div className={`mt-2 text-3xl font-heading font-black tracking-tighter ${c.color}`}>
                {c.value}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="font-heading font-semibold text-slate-900 mb-4">Program-wise Consumption</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={progs}>
                <XAxis dataKey="program" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip />
                <Bar dataKey="total_issued" fill="#1E1B4B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <div className="font-heading font-semibold text-slate-900 mb-4">Balance by Department</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={deptChart} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label>
                  {deptChart.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[deptChart.indexOf(entry) % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
