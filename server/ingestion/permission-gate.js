/**
 * بوابة الإذن — طبقة مستقلة.
 *
 * ===== لماذا ملف منفصل =====
 * في Sprint 2 كان هذا المنطق داخل sources/registry.js، أي مختلطًا بمسؤولية
 * تحميل المصادر. فصله يحقق أمرين:
 *   1) الجالب لا يعرف شيئًا عن السياسة، والسجل لا يقرر من يعمل.
 *      قرار "هل يُسمح" له موضع واحد يُراجَع ويُختبر وحده.
 *   2) يستحيل تجاوز البوابة بالخطأ: كل مسار تشغيل يمر بـ assertRunnable،
 *      والخط يستدعيها قبل لمس الشبكة.
 *
 * ===== القاعدة =====
 * المصدر الجديد ممنوع افتراضيًا.
 *
 *   pending  -> ممنوع
 *   denied   -> ممنوع
 *   disabled -> ممنوع
 *   بلا محوّل -> ممنوع
 *
 *   granted + enabled + adapter  -> مسموح  (الحالة الوحيدة)
 */

export const PERMISSION = Object.freeze({
  PENDING: "pending",
  GRANTED: "granted",
  DENIED: "denied",
});

export const BLOCK_REASON = Object.freeze({
  UNKNOWN_SOURCE: "unknown_source",
  PERMISSION_PENDING: "permission_pending",
  PERMISSION_DENIED: "permission_denied",
  NOT_GRANTED: "permission_not_granted",
  DISABLED: "source_disabled",
  NO_ADAPTER: "adapter_missing",
});

/** رسائل عربية مقابلة لكل سبب — للتقارير والتنبيهات. */
export const BLOCK_MESSAGE = Object.freeze({
  [BLOCK_REASON.UNKNOWN_SOURCE]: "مصدر غير معروف.",
  [BLOCK_REASON.PERMISSION_PENDING]: "وضع الإذن لم يُحسم بعد.",
  [BLOCK_REASON.PERMISSION_DENIED]: "المصدر مرفوض نهائيًا.",
  [BLOCK_REASON.NOT_GRANTED]: "لا يوجد إذن موثّق للمصدر.",
  [BLOCK_REASON.DISABLED]: "المصدر معطّل تشغيليًا.",
  [BLOCK_REASON.NO_ADAPTER]: "لا يوجد محوّل مسجَّل لهذا المصدر.",
});

export class PermissionDeniedError extends Error {
  constructor(reason, source) {
    super(`${BLOCK_MESSAGE[reason] ?? reason} (${source?.source_name ?? "بلا اسم"})`);
    this.name = "PermissionDeniedError";
    this.reason = reason;
    this.sourceName = source?.source_name ?? null;
  }
}

/**
 * الحكم على مصدر واحد. دالة نقية.
 *
 * @param {object} source
 * @param {{hasAdapter?: (name: string) => boolean}} [deps]
 *        فحص وجود المحوّل يُحقن، فلا تعتمد البوابة على سجل المحوّلات مباشرة.
 * @returns {{allowed: boolean, reason: string|null, message: string|null}}
 */
export function evaluateSource(source, { hasAdapter } = {}) {
  const deny = (reason) => ({ allowed: false, reason, message: BLOCK_MESSAGE[reason] ?? null });

  if (!source || typeof source !== "object") return deny(BLOCK_REASON.UNKNOWN_SOURCE);

  if (source.permission_status === PERMISSION.DENIED) return deny(BLOCK_REASON.PERMISSION_DENIED);
  if (source.permission_status === PERMISSION.PENDING) return deny(BLOCK_REASON.PERMISSION_PENDING);
  if (source.permission_status !== PERMISSION.GRANTED) return deny(BLOCK_REASON.NOT_GRANTED);

  if (source.enabled !== true) return deny(BLOCK_REASON.DISABLED);

  if (!source.adapter) return deny(BLOCK_REASON.NO_ADAPTER);
  if (typeof hasAdapter === "function" && !hasAdapter(source.adapter)) {
    return deny(BLOCK_REASON.NO_ADAPTER);
  }

  return { allowed: true, reason: null, message: null };
}

/** صيغة رامية — لمن يريد الفشل الصريح بدل فحص النتيجة. */
export function assertRunnable(source, deps) {
  const verdict = evaluateSource(source, deps);
  if (!verdict.allowed) throw new PermissionDeniedError(verdict.reason, source);
  return true;
}

/** يفصل المسموح عن الممنوع مع تسجيل سبب كل استبعاد. */
export function selectRunnable(sources, { hasAdapter, logger } = {}) {
  const runnable = [];
  const blocked = [];

  for (const source of sources ?? []) {
    const verdict = evaluateSource(source, { hasAdapter });
    if (verdict.allowed) {
      runnable.push(source);
      continue;
    }
    blocked.push({
      source_name: source?.source_name ?? "(بلا اسم)",
      reason: verdict.reason,
      message: verdict.message,
    });
    logger?.warn?.("source_blocked", {
      source: source?.source_name,
      reason: verdict.reason,
      permission_status: source?.permission_status,
      enabled: source?.enabled,
    });
  }

  return { runnable, blocked };
}
