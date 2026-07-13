import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, PageBody, ExportButton } from "./_shared";
import { Card } from "@/components/ui/card";
import { FilterBar, toParams } from "./_filterbar";
import { downloadExcel } from "@/lib/utils-app";

export default function LowStock() {
  const [rows, setRows] = useState([]);
  const [flt, setFlt] = useState({ department: "all", program: "all", search: "" });
  const load = useCallback(async () => {
    const r = await api.get("/reports/low-stock", { params: toParams(flt) });
    setRows(r.data);
  }, [flt]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <PageHeader
        title="Low Stock"
        subtitle="Balance ≤ sum of last 3 months utilisation (critical value)"
        actions={<ExportButton onClick={() => downloadExcel(api, "low-stock", flt.department === "all" ? "" : flt.department)} />}
      />
      <PageBody>
        <Card>
          <FilterBar value={flt} onChange={setFlt} extras={<div className="ml-auto text-xs text-slate-500">{rows.length} items</div>} />
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Dept</th><th>Item</th><th>Pack</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Critical (3m)</th>
                </tr>
              </thead>
              <tbody data-testid="ls-body">
                {rows.map((r) => (
                  <tr key={`${r.department}|${r.item_name}|${r.pack_size}`} className="border-l-2 border-orange-500">
                    <td>{r.department}</td>
                    <td className="font-medium text-slate-900">{r.item_name}</td>
                    <td>{r.pack_size}</td>
                    <td className="text-right tabular-nums font-bold text-orange-600">{r.balance}</td>
                    <td className="text-right tabular-nums">{r.critical_value}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400">No low-stock items.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
