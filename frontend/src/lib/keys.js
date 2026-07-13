/** Small stable-key helper used by report table rows. */
export function rowKey(r) {
  return [r.department, r.item_name, r.pack_size, r.lot_number || "", r.expiry_date || ""]
    .join("|");
}
