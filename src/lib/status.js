/**
 * نموذج حالة العروض — مصدر حقيقة واحد للواجهة.
 *
 * يقابل تمامًا: supabase/migrations/0002_status_and_soft_delete.sql
 * أي تعديل هنا يجب أن يقابله تعديل هناك، والعكس.
 *
 * السبب: قبل هذا الملف كان حقل status يُقرأ في mapProperty ثم يُهمل تمامًا،
 * فكان كل صف في جدول properties منشورًا للعامة بغض النظر عن حالته.
 */

export const STATUS = Object.freeze({
  PUBLISHED: "published",
  DRAFT: "draft",
  ARCHIVED: "archived",
  REJECTED: "rejected",
});

export const ALL_STATUSES = Object.freeze([
  STATUS.PUBLISHED,
  STATUS.DRAFT,
  STATUS.ARCHIVED,
  STATUS.REJECTED,
]);

/** القيم العربية القديمة التي قد تكون موجودة في بيانات سابقة. */
const LEGACY_MAP = Object.freeze({
  متاح: STATUS.PUBLISHED,
  متوفر: STATUS.PUBLISHED,
  منشور: STATUS.PUBLISHED,
  مباع: STATUS.ARCHIVED,
  مؤجر: STATUS.ARCHIVED,
  محجوز: STATUS.ARCHIVED,
  منتهي: STATUS.ARCHIVED,
  مؤرشف: STATUS.ARCHIVED,
  مسودة: STATUS.DRAFT,
  "قيد المراجعة": STATUS.DRAFT,
  مرفوض: STATUS.REJECTED,
});

export const STATUS_LABELS = Object.freeze({
  [STATUS.PUBLISHED]: "منشور",
  [STATUS.DRAFT]: "مسودة",
  [STATUS.ARCHIVED]: "مؤرشف",
  [STATUS.REJECTED]: "مرفوض",
});

/**
 * يحوّل أي قيمة حالة (معيارية أو عربية قديمة أو فارغة) إلى قيمة معيارية.
 *
 * قراران مقصودان ومختلفان عن بعضهما:
 *
 * 1) الفارغ / null  ->  published
 *    حفاظًا على السلوك القائم بالضبط. الكود السابق كان:
 *      status: row.status || "متاح"
 *    أي أن الصف بلا حالة كان يظهر للعامة. لو حوّلناه إلى مسودة
 *    لاختفت كل عروض المكتب التي لم تُضبط حالتها — تراجع غير مقبول.
 *
 * 2) قيمة نصية غير معروفة  ->  draft
 *    هنا الإخفاء هو الخيار الآمن: إخفاء عرض بالخطأ قابل للتراجع،
 *    ونشر عرض بالخطأ ليس كذلك.
 */
export function normalizeStatus(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return STATUS.PUBLISHED;
  if (ALL_STATUSES.includes(raw)) return raw;
  return LEGACY_MAP[raw] ?? STATUS.DRAFT;
}

/** هل يظهر هذا الصف لزائر غير مسجّل؟ */
export function isPubliclyVisible(row) {
  if (!row) return false;
  if (row.deleted_at || row.deletedAt) return false;
  return normalizeStatus(row.status) === STATUS.PUBLISHED;
}

/** فلترة قائمة لعرضها في الأقسام العامة من الموقع. */
export function publicOnly(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(isPubliclyVisible);
}

export function statusLabel(value) {
  return STATUS_LABELS[normalizeStatus(value)];
}
