/**
 * إدراج عروض معين عبابنه في جدول properties (عروض المكتب).
 *
 * ===== قرار صاحب المشروع 2026-08-20 =====
 * لا يُدرج السعر إطلاقًا.
 *
 * السبب ليس تحفظًا: استخراج السعر من نص بلهجة محلية أثبت خطورته —
 * "٢٩٦٦٠الف" كادت تُقرأ 29,660,000 بدل 29,660، أي ألف ضعف. سعر خاطئ
 * على موقع عقاري ضرر حقيقي، والمساحة والموقع والخدمات تكفي لجذب
 * المهتم، ثم يُحسم السعر بالتواصل المباشر.
 *
 * يُدرج فقط ما هو موثوق ومباشر في النص:
 *   النوع · الموقع · المساحة · تفاصيل الخدمات والوصف · الهاتف
 *
 * ===== لماذا properties لا external_offers =====
 * معين موظف في المكتب وهذه عروض المكتب نفسه، لا وساطة خارجية.
 * source_type = 'office' موجود أصلًا في الجدول.
 *
 * التشغيل (يحتاج service_role):
 *   node scripts/import-muain-offers.mjs --dry
 *   node scripts/import-muain-offers.mjs --commit
 */

import { createClient } from "@supabase/supabase-js";
import { REAL_ESTATE_POSTS, NON_PROPERTY_POSTS, TRUNCATED_POSTS, AUTHOR, CONTACT }
  from "../server/ingestion/__fixtures__/muain-posts-2026-08.js";
import {
  classifyPost, extractType, extractLocation, extractSize, extractPhone,
} from "../server/ingestion/adapters/muain-ababneh.js";
import { cleanText } from "../server/ingestion/normalize.js";

const args = process.argv.slice(2);
const commit = args.includes("--commit");

/** النص المتفق عليه لغياب السعر — مطابق لبقية النظام. */
const NO_PRICE = "السعر عند التواصل";

/** أسطر لا تحمل معلومة عن العقار. */
const NOISE = [
  /^بسم الله/, /^الله يبارك/, /^#/, /^0\d{9}$/, /^٠[٠-٩]{9}$/,
  /^00962\d+$/, /@\S+$/, /See less$/, /See more$/,
];

/** يزيل السطور التي تحمل سعرًا — لا يصل أي رقم سعر إلى الوصف. */
const PRICE_LINE = /سعر|السعر|دينار|دنانير|الف|ألف|للمتر/;

/**
 * يبني وصفًا من تفاصيل الأرض الموثوقة فقط.
 * كل سطر يذكر سعرًا يُحذف كاملًا — لا نصف سعر ولا تلميح.
 */
function buildNote(text) {
  const lines = String(text).split(/\n+/).map(cleanText).filter(Boolean);
  const kept = lines.filter(
    (l) => !NOISE.some((r) => r.test(l)) && !PRICE_LINE.test(l)
  );
  const note = kept.join(" · ");
  return note.length > 400 ? `${note.slice(0, 400).trim()}…` : note;
}

/** يحوّل منشورًا إلى صف properties — بلا سعر. */
export function postToProperty(post) {
  const text = post.text ?? "";

  if (/See more$/.test(text.trim())) {
    return { skip: true, reason: "نص مقطوع — لا يُستخرج مما لا نراه كاملًا" };
  }
  if (!classifyPost(text).isProperty) {
    return { skip: true, reason: "منشور غير عقاري" };
  }

  const type = extractType(text);
  if (!type) return { skip: true, reason: "نوع العقار غير واضح" };

  const location = extractLocation(text);
  if (!location) return { skip: true, reason: "الموقع غير واضح" };

  const size = extractSize(text);

  return {
    skip: false,
    row: {
      type: type.label,
      location,
      size: size.m2 ? `${size.m2.toLocaleString("en-US")} م²` : "المساحة عند التواصل",
      // ⚠️ لا سعر. قرار مقصود لتجنّب نشر رقم خاطئ.
      price: NO_PRICE,
      note: buildNote(text),
      badge: "عادي",
      phone: extractPhone(text) ?? CONTACT,
      image_url: "🏞️",
      status: "published",
      source_type: "office",
      source_name: AUTHOR,
      source_consent: true,
      source_checked_at: String(post.created_time).slice(0, 10),
      created_by_name: AUTHOR,
      updated_by_name: AUTHOR,
    },
  };
}

function normalizeUrl(raw = "") {
  const t = String(raw).trim();
  if (!t) return "";
  try { return new URL(t).origin; } catch { return t.replace(/\/+$/, ""); }
}

async function main() {
  const prepared = [];
  const skipped = [];

  for (const post of REAL_ESTATE_POSTS) {
    const result = postToProperty(post);
    if (result.skip) skipped.push({ id: post.id, reason: result.reason });
    else prepared.push({ id: post.id, ...result.row });
  }
  for (const post of [...NON_PROPERTY_POSTS, ...TRUNCATED_POSTS]) {
    const result = postToProperty(post);
    skipped.push({ id: post.id, reason: result.reason ?? "غير متوقع" });
  }

  console.log(`\n=== جاهز للإدراج: ${prepared.length} عرض ===`);
  for (const row of prepared) {
    console.log(`\n  ${row.type} | ${row.location}`);
    console.log(`    المساحة: ${row.size}   |   السعر: ${row.price}`);
    console.log(`    ${row.note.slice(0, 110)}`);
  }

  console.log(`\n=== مُستبعد: ${skipped.length} ===`);
  for (const s of skipped) console.log(`  ${s.id.padEnd(20)} ${s.reason}`);

  // حارس: لا يمر أي رقم سعر إلى قاعدة البيانات.
  const leaked = prepared.filter(
    (r) => r.price !== NO_PRICE || /\d{3,}\s*(دينار|دنانير)/.test(r.note)
  );
  if (leaked.length) {
    throw new Error(`تسرّب سعر إلى ${leaked.length} صف — أُوقف الإدراج.`);
  }
  console.log("\n  حارس الأسعار: لا رقم سعر في أي صف ✅");

  if (!commit) {
    console.log("\n(تجربة فقط — استخدم --commit للإدراج الفعلي)");
    return;
  }

  const url = normalizeUrl(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("يحتاج SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.");

  const db = createClient(url, key, { auth: { persistSession: false } });

  // منع التكرار: لا نُدرج عرضًا موجودًا بنفس النوع والموقع والمساحة.
  const { data: existing, error: readError } = await db
    .from("properties").select("type, location, size");
  if (readError) throw new Error(readError.message);

  const seen = new Set(
    (existing ?? []).map((r) => `${r.type}|${r.location}|${r.size}`.trim())
  );

  const fresh = prepared
    .map(({ id, ...row }) => row)
    .filter((row) => !seen.has(`${row.type}|${row.location}|${row.size}`.trim()));

  console.log(`\n  جديد فعلًا: ${fresh.length} | مكرر: ${prepared.length - fresh.length}`);
  if (!fresh.length) { console.log("  لا شيء ليُدرج."); return; }

  const { data, error } = await db.from("properties").insert(fresh).select("id");
  if (error) throw new Error(error.message);

  console.log(`\n✅ أُدرج: ${data.length} عرض في properties`);

  const { count } = await db.from("properties").select("*", { count: "exact" }).limit(1);
  console.log(`   إجمالي عروض المكتب الآن: ${count}`);
}

main().catch((error) => {
  console.error(`فشل: ${error.message}`);
  process.exit(1);
});
