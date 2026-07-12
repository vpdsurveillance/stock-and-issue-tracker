import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, PageBody, ExportButton } from "./_shared";
import { Card } from "@/components/ui/card";
import { FilterBar, toParams } from "./_filterbar";
import { downloadExcel } from "@/lib/utils-app";

export default function NilStock() {
  const [rows, setRows] = useState([]);
  const [flt, setFlt] = useState({ department: "all", program: "all", search: "" });
  useEffect(() => {
    api.get("/reports/nil-stock", { params: toParams(flt) }).then((r) => setRows(r.data));
  }, [flt]);
  return (
    <>
      <PageHeader
        title="NIL Stock"
        subtitle="Items with zero current balance"
        actions={<ExportButton onClick={() => downloadExcel(api, "nil-stock", flt.department === "all" ? "" : flt.department)} />}
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
                </tr>
              </thead>
              <tbody data-testid="ns-body">
                {rows.map((r, i) => (
                  <tr key={i} className="border-l-2 border-red-500">
                    <td>{r.department}</td>
                    <td className="font-medium text-slate-900">{r.item_name}</td>
                    <td>{r.pack_size}</td>
                    <td className="text-right tabular-nums font-bold text-red-600">{r.balance}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400">All items have stock.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
