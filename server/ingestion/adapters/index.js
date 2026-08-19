/**
 * سجل المحوّلات.
 *
 * إضافة مصدر جديد = محوّل هنا + صف في جدول sources بحالة إذن صريحة.
 * لا يمكن تشغيل مصدر بلا محوّل مسجَّل — evaluateSource ترفضه بـ adapter_missing.
 */

import { adapter as daleelaqar } from "./daleelaqar.js";

const ADAPTERS = new Map([[daleelaqar.name, daleelaqar]]);

export function getAdapter(name) {
  return ADAPTERS.get(name) ?? null;
}

export function listAdapters() {
  return [...ADAPTERS.values()].map((a) => ({ name: a.name, host: a.host }));
}
