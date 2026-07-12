import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, PageBody, ExportButton } from "./_shared";
import { Card } from "@/components/ui/card";
import { FilterBar, toParams } from "./_filterbar";
import { downloadExcel } from "@/lib/utils-app";

export default function IndentNextYear() {
  const [rows, setRows] = useState([]);
  const [flt, setFlt] = useState({ department: "all", program: "all", search: "" });
  useEffect(() => {
    api.get("/reports/indent-next-year", { params: toParams(flt) }).then((r) => setRows(r.data));
  }, [flt]);

  return (
    <>
      <PageHeader
        title="Indent for Next Year"
        subtitle="Projected requirement = last 12-month utilisation"
        actions={<ExportButton onClick={() => downloadExcel(api, "indent-next-year", flt.department === "all" ? "" : flt.department)} />}
      />
      <PageBody>
        <Card>
          <FilterBar value={flt} onChange={setFlt} extras={<div className="ml-auto text-xs text-slate-500">{rows.length} items</div>} />
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Dept</th><th>Item</th><th>Pack</th>
                  <th className="text-right">12-month utilisation</th>
                  <th className="text-right">Avg / month</th>
                  <th className="text-right">Indent (next year)</th>
                </tr>
              </thead>
              <tbody data-testid="in-body">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.department}</td>
                    <td className="font-medium text-slate-900">{r.item_name}</td>
                    <td>{r.pack_size}</td>
                    <td className="text-right tabular-nums">{r.yearly_utilisation}</td>
                    <td className="text-right tabular-nums">{r.avg_monthly}</td>
                    <td className="text-right tabular-nums font-bold text-indigo-950">{r.indent_next_year}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Not enough issue history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
