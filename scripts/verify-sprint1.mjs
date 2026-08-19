/**
 * تحقق من جاهزية Sprint 1 — قراءة فقط، بلا أي كتابة.
 *
 * التشغيل:
 *   node scripts/verify-sprint1.mjs
 *
 * يقرأ المفتاح العام من .env.local تلقائيًا. لا يحتاج service_role.
 *
 * مبدأ حاكم: الفحص الذي لا يستطيع إثبات ما يدّعيه لا يُحتسب نجاحًا.
 * يُصنَّف "غير قابل للتحقق" ويُحال إلى الفحص المكافئ في SQL.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function fromEnvFile(key) {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

const url = process.env.SUPABASE_URL ?? fromEnvFile("VITE_SUPABASE_URL");
const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? fromEnvFile("VITE_SUPABASE_ANON_KEY");

if (!url || !key) {
  console.error("إعدادات Supabase مفقودة (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const CANONICAL = ["published", "draft", "archived", "rejected"];
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** فحص غير محتسب — لا يمكن إثباته من جهة العميل. */
function note(name, detail) {
  console.log(`➖ ${name} — ${detail}`);
}

/**
 * تصنيف دقيق لأخطاء PostgREST.
 *
 * مُثبت بالتجربة على قاعدة البيانات الفعلية:
 *   جدول غير موجود -> PGRST205
 *   عمود غير موجود -> 42703
 *   RLS تحجب صفوفًا -> لا خطأ إطلاقًا، مصفوفة فارغة
 */
function classify(error) {
  if (!error) return "none";
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "PGRST205" || code === "42P01" || /could not find the table|relation .* does not exist/i.test(message)) {
    return "missing_table";
  }
  if (code === "42703" || code === "PGRST204" || /column .* does not exist/i.test(message)) {
    return "missing_column";
  }
  if (code === "42501" || /permission denied/i.test(message)) return "permission";
  return "other";
}

console.log("=== جداول Sprint 1 ===");
for (const table of ["properties", "team", "contacts", "external_offers", "leads", "audit_log"]) {
  const { error } = await db.from(table).select("*").limit(1);
  const kind = classify(error);
  record(
    `جدول ${table}`,
    kind !== "missing_table" && kind !== "other",
    kind === "none" ? "موجود" : kind === "missing_table" ? "مفقود — شغّل الترحيل المناسب" : `خطأ غير متوقع: ${error.message}`
  );
}

console.log("\n=== الأعمدة الجديدة ===");
// properties وحده يحصل على الحذف الناعم (0005). team يستخدم is_visible القائم.
for (const [table, column, migration] of [
  ["properties", "legacy_status", "0002"],
  ["properties", "deleted_at", "0005"],
]) {
  const { error } = await db.from(table).select(column).limit(1);
  const kind = classify(error);
  record(
    `${table}.${column}`,
    kind === "none",
    kind === "none" ? "موجود" : kind === "missing_column" ? `غير موجود — ${migration} لم يُنفَّذ بعد` : `خطأ: ${error.message}`
  );
}

// تأكيد مقصود: team يجب ألا يحصل على deleted_at إطلاقًا.
// ⚠️ الفحص السابق كان ينجح على أي خطأ — بما فيه انقطاع الشبكة أو حذف الجدول.
//    الآن ينجح فقط إذا كان الخطأ تحديدًا "العمود غير موجود".
{
  const { error } = await db.from("team").select("deleted_at").limit(1);
  const kind = classify(error);
  record(
    "team بلا deleted_at (مقصود)",
    kind === "missing_column",
    kind === "missing_column" ? "غير موجود كما هو مخطط"
      : kind === "none" ? "أُضيف بلا داعٍ — راجع الترحيلات"
      : `تعذر التحقق (${kind})`
  );
}
{
  const { data, error } = await db.from("team").select("is_visible").limit(1);
  record(
    "team.is_visible متاح للإخفاء",
    !error && Array.isArray(data) && data.length > 0,
    error ? `${classify(error)}: ${error.message}` : "موجود"
  );
}

console.log("\n=== خصوصية الطلبات ===");
{
  // ⚠️ هذا الفحص غير قابل للإثبات من جهة العميل.
  //
  // عند حجب RLS للقراءة، يُرجع PostgREST مصفوفة فارغة بلا أي خطأ —
  // وهو ناتج لا يمكن تمييزه عن "الجدول موجود وفارغ".
  // وجدول leads فارغ فعلًا الآن.
  //
  // الفحص القاطع الوحيد هو استعلام السياسات في SQL:
  //   supabase/audit/post_migration_checks.sql -> الفحصان 17 و 18
  const { data, error } = await db.from("leads").select("id").limit(1);
  const kind = classify(error);
  if (kind === "missing_table") {
    record("جدول leads موجود", false, "مفقود — 0003 لم يُنفَّذ");
  } else {
    note(
      "حجب القراءة العامة على leads",
      `غير قابل للتحقق من جهة العميل (الجدول أعاد ${data?.length ?? 0} صف بلا خطأ). ` +
        "استخدم post_migration_checks.sql الفحصين 17 و 18."
    );
  }
}

console.log("\n=== قيم status ===");
const { data: props, error: propsError } = await db.from("properties").select("status");
if (propsError) {
  record("قراءة properties", false, propsError.message);
} else {
  const counts = {};
  for (const row of props) {
    const k = row.status ?? "(null)";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const legacy = Object.keys(counts).filter((s) => !CANONICAL.includes(s));
  record(
    "قيم status معيارية",
    legacy.length === 0,
    legacy.length ? `ما زالت قيم قديمة: ${legacy.join(", ")} — 0002 لم يُنفَّذ` : JSON.stringify(counts)
  );

  // ⚠️ الفحص السابق كان يأخذ published أو 'متاح' لا مجموعهما،
  //    فكان يُبلّغ رقمًا ناقصًا لو اختلطت القيمتان أثناء ترحيل جزئي.
  const visible = (counts.published ?? 0) + (counts["متاح"] ?? 0) + (counts["منشور"] ?? 0);
  record("توجد عروض ظاهرة للعامة", visible > 0, `${visible} عرض منشور من ${props.length}`);
}

console.log("\n=== سلامة البيانات القائمة ===");
for (const [table, min] of [["properties", 3], ["team", 3], ["contacts", 1], ["external_offers", 8]]) {
  // count:"exact" يعطي العدد الحقيقي بلا الاعتماد على طول المصفوفة المُعادة.
  const { count, error } = await db.from(table).select("*", { count: "exact" }).limit(1);
  record(
    `${table} يحتفظ ببياناته`,
    !error && typeof count === "number" && count >= min,
    error ? `${classify(error)}: ${error.message}` : `${count} صف (المتوقع ≥ ${min})`
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== النتيجة: ${results.length - failed.length}/${results.length} ناجح ===`);
if (failed.length) {
  console.log("يحتاج تدخلًا:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
