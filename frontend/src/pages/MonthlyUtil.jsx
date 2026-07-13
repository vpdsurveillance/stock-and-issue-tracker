import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, PageBody, ExportButton } from "./_shared";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterBar, toParams } from "./_filterbar";
import { downloadExcel } from "@/lib/utils-app";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthlyUtil() {
  const [rows, setRows] = useState([]);
  const [flt, setFlt] = useState({ department: "all", program: "all", search: "" });
  const [year, setYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    const r = await api.get("/reports/monthly-utilisation", { params: { ...toParams(flt), year } });
    setRows(r.data);
  }, [flt, year]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Monthly Utilisation"
        subtitle="Track monthly consumption per item and year"
        actions={<ExportButton onClick={() => downloadExcel(api, "monthly-utilisation", flt.department === "all" ? "" : flt.department)} />}
      />
      <PageBody>
        <Card>
          <FilterBar
            value={flt}
            onChange={setFlt}
            extras={
              <>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-28"
                  data-testid="mu-year"
                />
                <div className="ml-auto text-xs text-slate-500">{rows.length} items</div>
              </>
            }
          />
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Dept</th><th>Item</th><th>Pack</th>
                  {MONTHS.map((m) => <th key={m} className="text-right">{m}</th>)}
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody data-testid="mu-body">
                {rows.map((r) => {
                  const rk = `${r.department}|${r.item_name}|${r.pack_size}`;
                  return (
                    <tr key={rk}>
                      <td>{r.department}</td>
                      <td className="font-medium text-slate-900">{r.item_name}</td>
                      <td>{r.pack_size}</td>
                      {MONTHS.map((mLabel, mi) => (
                        <td key={`${rk}-m${mi}`} className="text-right tabular-nums">{r[`m${mi + 1}`] || 0}</td>
                      ))}
                      <td className="text-right tabular-nums font-bold">{r.total}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={16} className="text-center py-8 text-slate-400">No issues for {year}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
