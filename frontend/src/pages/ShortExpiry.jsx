import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, PageBody, ExportButton } from "./_shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar, toParams } from "./_filterbar";
import { downloadExcel, fmtDate } from "@/lib/utils-app";

export default function ShortExpiry() {
  const [rows, setRows] = useState([]);
  const [flt, setFlt] = useState({ department: "all", program: "all", search: "" });
  useEffect(() => {
    api.get("/reports/short-expiry", { params: toParams(flt) }).then((r) => setRows(r.data));
  }, [flt]);
  return (
    <>
      <PageHeader
        title="Short Expiry"
        subtitle="Items expiring within 90 days"
        actions={<ExportButton onClick={() => downloadExcel(api, "short-expiry", flt.department === "all" ? "" : flt.department)} />}
      />
      <PageBody>
        <Card>
          <FilterBar value={flt} onChange={setFlt} extras={<div className="ml-auto text-xs text-slate-500">{rows.length} items</div>} />
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Dept</th><th>Item</th><th>Pack</th><th>Lot</th>
                  <th>Expiry</th><th className="text-right">Days left</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody data-testid="se-report-body">
                {rows.map((r, i) => (
                  <tr key={i} className="border-l-2 border-amber-500">
                    <td>{r.department}</td>
                    <td className="font-medium text-slate-900">{r.item_name}</td>
                    <td>{r.pack_size}</td>
                    <td>{r.lot_number}</td>
                    <td>{fmtDate(r.expiry_date)}</td>
                    <td className="text-right">
                      <Badge className={r.days_to_expiry < 30 ? "bg-red-600" : "bg-amber-500"}>
                        {r.days_to_expiry} days
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums font-bold">{r.balance}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">Nothing expiring soon.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
