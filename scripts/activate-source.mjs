/**
 * تفعيل مصدر في سجل المصادر.
 *
 * ===== لماذا سكربت منفصل =====
 * تفعيل مصدر قرار إداري نادر، لا شيء يفعله وكيل تلقائيًا. عزله في
 * سكربت يُشغَّل يدويًا يجعل الفعل مقصودًا ومسجَّلًا، ويمنع أي وكيل من
 * ترقية صلاحيات نفسه.
 *
 * ===== لماذا لا يحتاج SQL Editor =====
 * تغيير permission_status و enabled تعديل *بيانات* لا مخطط، وPostgREST
 * ينفّذه بـ service_role. الوحيد الذي يحتاج SQL Editor هو إضافة أعمدة.
 *
 * التشغيل (يحتاج service_role — لا يعمل بالمفتاح العام):
 *   node scripts/activate-source.mjs --source "دليل عقار" --grant
 *   node scripts/activate-source.mjs --source "دليل عقار" --revoke
 *   node scripts/activate-source.mjs --list
 */

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};

function normalizeUrl(raw = "") {
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

const url = normalizeUrl(process.env.SUPABASE_URL);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("يحتاج SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.");
  console.error("تفعيل المصدر عملية إدارية — لا تعمل بالمفتاح العام.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function list() {
  const { data, error } = await db
    .from("sources")
    .select("source_name, source_type, adapter, permission_status, enabled, source_url, last_offer_count")
    .order("source_name");
  if (error) throw new Error(error.message);

  console.log("\n=== سجل المصادر ===");
  for (const s of data ?? []) {
    const runnable = s.permission_status === "granted" && s.enabled;
    console.log(
      `  ${String(s.source_name).padEnd(24)} ${String(s.permission_status).padEnd(9)}` +
      ` enabled=${String(s.enabled).padEnd(6)} يعمل=${runnable ? "نعم" : "لا"}`
    );
    console.log(`     المحوّل: ${s.adapter} | آخر حصيلة: ${s.last_offer_count ?? "—"}`);
    console.log(`     الرابط : ${s.source_url}`);
  }
  return data ?? [];
}

/**
 * يمنح الإذن ويفعّل المصدر.
 * التوثيق إلزامي: لا تُقلب الحالة بلا سبب مكتوب وتاريخ.
 */
async function grant(sourceName, { sourceUrl, note } = {}) {
  const payload = {
    permission_status: "granted",
    enabled: true,
    permission_note: note,
    permission_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (sourceUrl) payload.source_url = sourceUrl;

  const { data, error } = await db
    .from("sources")
    .update(payload)
    .eq("source_name", sourceName)
    .select("source_name, permission_status, enabled, source_url")
    .maybeSingle();

  if (error) throw new Error(error.message);
  // رفض RLS يظهر كنجاح بصفر صفوف — لا نعتبره تفعيلًا.
  if (!data) throw new Error(`لم يُعثر على المصدر "${sourceName}" أو رُفض التحديث.`);
  return data;
}

async function revoke(sourceName) {
  const { data, error } = await db
    .from("sources")
    .update({
      permission_status: "pending",
      enabled: false,
      permission_note: `أُوقف بقرار إداري ${new Date().toISOString().slice(0, 10)}.`,
      updated_at: new Date().toISOString(),
    })
    .eq("source_name", sourceName)
    .select("source_name, permission_status, enabled")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`لم يُعثر على المصدر "${sourceName}".`);
  return data;
}

const GRANT_NOTES = {
  "دليل عقار":
    "إذن ممنوح بقرار صاحب المشروع 2026-08-20. robots.txt يسمح بـ /nav/ ويعلن sitemap؛ "
    + "المسار الممنوع /property/ مرفوض بنيويًا في المحوّل. مهلة تهذيب 800ms بين الطلبات.",
};

const SOURCE_URLS = {
  "دليل عقار": "https://daleelaqar.com/sitemap.xml",
};

async function main() {
  if (flag("list") || args.length === 0) {
    await list();
    return;
  }

  const source = value("source");
  if (!source) throw new Error("حدّد --source \"اسم المصدر\"");

  if (flag("grant")) {
    const note = GRANT_NOTES[source] ?? `إذن ممنوح بقرار إداري ${new Date().toISOString().slice(0, 10)}.`;
    const result = await grant(source, { sourceUrl: SOURCE_URLS[source], note });
    console.log(`\n✅ فُعّل: ${result.source_name}`);
    console.log(`   الحالة: ${result.permission_status} | enabled=${result.enabled}`);
    console.log(`   الرابط: ${result.source_url}`);
  } else if (flag("revoke")) {
    const result = await revoke(source);
    console.log(`\n⛔ أُوقف: ${result.source_name} -> ${result.permission_status}`);
  } else {
    throw new Error("استخدم --grant أو --revoke أو --list");
  }

  await list();
}

main().catch((error) => {
  console.error(`فشل: ${error.message}`);
  process.exit(1);
});
