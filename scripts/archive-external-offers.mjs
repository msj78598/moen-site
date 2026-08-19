/**
 * سحب العروض الخارجية من النشر.
 *
 * ===== السبب =====
 * بعض المواقع تمنع صراحةً إعادة نشر عروضها. قرار صاحب المشروع
 * (2026-08-20): سحب كل العروض التسويقية الخارجية من الموقع.
 *
 * ===== لماذا أرشفة لا حذف =====
 * الأرشفة تُخفي العرض عن الزائر فورًا — وهو المطلوب قانونيًا — وتبقى
 * قابلة للعكس. الحذف النهائي ممنوع بنيويًا في النظام (revoke delete
 * على كل الجداول)، وهو قيد مقصود لا عيب.
 *
 * إن أردت المسح النهائي من قاعدة البيانات فهو قرار منفصل يحتاج
 * SQL Editor:  delete from public.external_offers where source_name = '...';
 *
 * التشغيل (يحتاج service_role):
 *   node scripts/archive-external-offers.mjs --all
 *   node scripts/archive-external-offers.mjs --source "دليل عقار"
 *   node scripts/archive-external-offers.mjs --status
 */

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const value = (n) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 ? args[i + 1] : undefined;
};

function normalizeUrl(raw = "") {
  const t = String(raw).trim();
  if (!t) return "";
  try { return new URL(t).origin; } catch { return t.replace(/\/+$/, ""); }
}

const url = normalizeUrl(process.env.SUPABASE_URL);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("يحتاج SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function status() {
  const { data, error } = await db.from("external_offers").select("source_name, status");
  if (error) throw new Error(error.message);

  const groups = {};
  for (const row of data ?? []) {
    const k = `${row.source_name} / ${row.status}`;
    groups[k] = (groups[k] ?? 0) + 1;
  }
  console.log("\n=== حالة العروض الخارجية ===");
  for (const [k, n] of Object.entries(groups).sort()) console.log(`  ${k.padEnd(34)} ${n}`);
  const published = (data ?? []).filter((r) => r.status === "published").length;
  console.log(`  ${"—".repeat(34)}`);
  console.log(`  ${"المنشور (ظاهر للزائر)".padEnd(34)} ${published}`);
  return published;
}

/**
 * يؤرشف العروض المنشورة. تحديث status فقط — لا حذف ولا لمس لأي حقل آخر.
 * الأرشفة هنا سحب مقصود من النشر، فلا تمر بحارس الجولة الناقصة الذي
 * يحمي من الأرشفة *غير المقصودة* الناتجة عن فشل كشط.
 */
async function archive({ sourceName } = {}) {
  let query = db
    .from("external_offers")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("status", "published");

  if (sourceName) query = query.eq("source_name", sourceName);

  const { data, error } = await query.select("id, source_name");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const bySource = {};
  for (const r of rows) bySource[r.source_name] = (bySource[r.source_name] ?? 0) + 1;

  console.log(`\n✅ سُحب من النشر: ${rows.length} عرض`);
  for (const [name, n] of Object.entries(bySource)) console.log(`   ${name}: ${n}`);
  return rows.length;
}

async function main() {
  const before = await status();

  if (flag("status")) return;

  if (!flag("all") && !value("source")) {
    console.error("\nاستخدم --all أو --source \"اسم المصدر\" أو --status");
    process.exit(1);
  }

  if (before === 0) {
    console.log("\nلا يوجد عرض منشور — لا شيء ليُسحب.");
    return;
  }

  await archive({ sourceName: value("source") });
  const after = await status();

  if (after !== 0 && flag("all")) {
    throw new Error(`بقي ${after} عرضًا منشورًا — راجع الصلاحيات.`);
  }
}

main().catch((error) => {
  console.error(`فشل: ${error.message}`);
  process.exit(1);
});
