import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, PageBody, ExportButton } from "./_shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar, toParams } from "./_filterbar";
import { downloadExcel } from "@/lib/utils-app";

const REASON_STYLE = {
  "NIL Stock": "bg-red-100 text-red-700 border-red-200",
  "Low Stock": "bg-orange-100 text-orange-700 border-orange-200",
  "Short Expiry": "bg-amber-100 text-amber-700 border-amber-200",
};

export default function SupplyOrder() {
  const [rows, setRows] = useState([]);
  const [flt, setFlt] = useState({ department: "all", program: "all", search: "" });
  useEffect(() => {
    api.get("/reports/supply-order", { params: toParams(flt) }).then((r) => setRows(r.data));
  }, [flt]);
  return (
    <>
      <PageHeader
        title="Supply Order"
        subtitle="Consolidated view: NIL Stock, Low Stock and Short Expiry items"
        actions={<ExportButton onClick={() => downloadExcel(api, "supply-order", flt.department === "all" ? "" : flt.department)} />}
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
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody data-testid="so-body">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.department}</td>
                    <td className="font-medium text-slate-900">{r.item_name}</td>
                    <td>{r.pack_size}</td>
                    <td className="text-right tabular-nums">{r.balance}</td>
                    <td className="text-right tabular-nums">{r.critical_value}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.reasons.map((rn) => (
                          <Badge key={rn} variant="outline" className={`border ${REASON_STYLE[rn] || ""}`}>{rn}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">All good. Nothing to order.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
