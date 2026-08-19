/**
 * حارس الأرشفة — الحماية من الجولة الناقصة.
 *
 * ===== الحادثة التي يمنع تكرارها =====
 * سجلات GitHub Actions من 21 إلى 28 يوليو 2026 تُظهر نفس السطر كل يوم:
 *
 *   Qualified external offers: 8
 *   Upserted 8 external offers. New: 0. Archived stale: 78.
 *
 * انهار استخراج المصدر من ~86 عرضًا إلى 8، فاعتبر السكربت الـ78 الباقية
 * منتهية وأرشفها. لم تكن منتهية — كان المحلّل معطوبًا. ومرّ الأمر 22 يومًا
 * بلا إنذار لأن الجولة كانت تُنهي بـ exit 0.
 *
 * ===== القاعدة =====
 * قبل أي أرشفة تُقارن حصيلة الجولة الحالية بالسابقة. إن تجاوز الهبوط
 * `max_allowed_drop_percent` (من جدول sources) تُعتبر الجولة `suspicious`
 * و**تُمنع الأرشفة بالكامل** — لا أرشفة جزئية ولا "أرشف الآمن منها".
 *
 * ===== ما لا يمنعه =====
 * إدراج العروض الجديدة. العروض الثمانية التي وصلت حقيقية وإدراجها سليم؛
 * الخطر في أرشفة الاثنتين والثلاثين لا في نشر الثمانية. الحارس يفصل
 * بين العمليتين بدل تعطيل الجولة كلها.
 *
 * دوال نقية بالكامل — بلا شبكة وبلا قاعدة بيانات.
 */

export const RUN_INTEGRITY = Object.freeze({
  HEALTHY: "healthy",         // الحصيلة ضمن المتوقع -> الأرشفة مسموحة
  SUSPICIOUS: "suspicious",   // هبوط غير منطقي -> الأرشفة ممنوعة
  EMPTY_RUN: "empty_run",     // صفر نتائج -> الأرشفة ممنوعة
  NO_BASELINE: "no_baseline", // لا جولة سابقة للمقارنة -> الأرشفة ممنوعة
});

export const INTEGRITY_MESSAGE = Object.freeze({
  [RUN_INTEGRITY.HEALTHY]: "الحصيلة ضمن الحد المسموح.",
  [RUN_INTEGRITY.SUSPICIOUS]: "هبوط غير منطقي في عدد النتائج — الجولة مشبوهة.",
  [RUN_INTEGRITY.EMPTY_RUN]: "الجولة لم تُرجع أي نتيجة.",
  [RUN_INTEGRITY.NO_BASELINE]: "لا توجد جولة سابقة للمقارنة.",
});

export class ArchiveBlockedError extends Error {
  constructor(verdict) {
    super(
      `الأرشفة ممنوعة: ${INTEGRITY_MESSAGE[verdict.status] ?? verdict.status} ` +
      `(السابق ${verdict.previous_count} ← الحالي ${verdict.current_count}` +
      `${verdict.drop_percent === null ? "" : ` = هبوط ${verdict.drop_percent}%`}` +
      `${verdict.threshold === null ? "" : `، الحد ${verdict.threshold}%`})`
    );
    this.name = "ArchiveBlockedError";
    this.verdict = verdict;
  }
}

/**
 * نسبة الهبوط بين جولتين.
 * تُرجع 0 عند النمو أو الثبات — النمو ليس هبوطًا.
 *
 * @returns {number|null} null إن تعذّر الحساب
 */
export function dropPercent(previousCount, currentCount) {
  if (!Number.isFinite(previousCount) || previousCount <= 0) return null;
  if (!Number.isFinite(currentCount) || currentCount < 0) return null;
  if (currentCount >= previousCount) return 0;
  return Math.round(((previousCount - currentCount) / previousCount) * 100);
}

/**
 * الحكم على سلامة الجولة.
 *
 * الافتراضي هو المنع: كل حالة لا نستطيع إثبات سلامتها تمنع الأرشفة.
 * إخفاء عرض حي خطأ قابل للتصحيح؛ أرشفة 78 عرضًا حيًا ليست كذلك.
 *
 * @param {object} params
 * @param {number|null} params.previousCount  sources.last_offer_count
 * @param {number} params.currentCount        حصيلة الجولة الحالية
 * @param {number} params.maxAllowedDropPercent
 * @returns {{status, previous_count, current_count, drop_percent, threshold,
 *            archive_allowed, reason, message}}
 */
export function evaluateRunIntegrity({
  previousCount,
  currentCount,
  maxAllowedDropPercent = 30,
} = {}) {
  const previous = Number.isFinite(previousCount) ? previousCount : null;
  const current = Number.isFinite(currentCount) ? currentCount : 0;
  const threshold = Number.isFinite(maxAllowedDropPercent) && maxAllowedDropPercent >= 0
    ? maxAllowedDropPercent
    : 30;

  const verdict = (status, { drop = null, allowed = false } = {}) => ({
    status,
    previous_count: previous,
    current_count: current,
    drop_percent: drop,
    threshold,
    archive_allowed: allowed,
    reason: allowed ? null : status,
    message: INTEGRITY_MESSAGE[status],
  });

  // جولة فارغة: انهيار كامل. هذا بالضبط ما كان يسبق الكارثة.
  if (current === 0) return verdict(RUN_INTEGRITY.EMPTY_RUN);

  // لا خط أساس -> لا مقارنة ممكنة -> لا أرشفة.
  if (previous === null) return verdict(RUN_INTEGRITY.NO_BASELINE);

  // أول جولة حقيقية بعد صفر: لا شيء ليُؤرشف أصلًا.
  if (previous === 0) return verdict(RUN_INTEGRITY.HEALTHY, { drop: 0, allowed: true });

  const drop = dropPercent(previous, current);

  if (drop > threshold) return verdict(RUN_INTEGRITY.SUSPICIOUS, { drop });

  return verdict(RUN_INTEGRITY.HEALTHY, { drop, allowed: true });
}

/**
 * البوابة الإلزامية قبل أي أرشفة.
 * أي كود يؤرشف يجب أن يمر بها؛ الفشل صريح لا صامت.
 */
export function assertArchiveAllowed(verdict) {
  if (!verdict?.archive_allowed) throw new ArchiveBlockedError(verdict ?? {});
  return true;
}

/** صيغة مختصرة تحسب وتحكم في خطوة واحدة. */
export function guardArchive(params) {
  const verdict = evaluateRunIntegrity(params);
  assertArchiveAllowed(verdict);
  return verdict;
}
