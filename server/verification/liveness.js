/**
 * التحقق من حياة الإعلان.
 *
 * ===== المبدأ الحاكم =====
 * الفشل المؤقت ليس انتهاءً.
 *
 * انقطاع شبكة أو timeout أو خطأ 503 لا يعني أن الإعلان انتهى — يعني
 * أننا لم نستطع التحقق. الخلط بين الاثنين هو ما أرشف 78 عرضًا حيًا في
 * يوليو. لذلك تُفصل الحالات فصلًا حادًا:
 *
 *   active        الإعلان يستجيب -> يبقى منشورًا
 *   expired       دليل قاطع على الانتهاء (404 / 410) -> يجوز أرشفته
 *   unavailable   الصفحة موجودة لكن المحتوى يقول منتهٍ -> يجوز أرشفته
 *   check_failed  تعذّر التحقق (شبكة/مهلة/5xx) -> لا يُمس إطلاقًا
 *   review_required إشارات متضاربة -> قرار بشري
 *
 * لا تُتخذ أي أرشفة من محاولة واحدة فاشلة. تُشترط محاولات متعددة
 * متتالية بنفس النتيجة القاطعة.
 *
 * دوال نقية عدا checkOffer التي تستقبل الجالب محقونًا.
 */

export const LIVENESS = Object.freeze({
  ACTIVE: "active",
  EXPIRED: "expired",
  UNAVAILABLE: "unavailable",
  CHECK_FAILED: "check_failed",
  REVIEW_REQUIRED: "review_required",
});

/** الحالات التي تسمح — مبدئيًا — بالأرشفة. */
const ARCHIVABLE = new Set([LIVENESS.EXPIRED, LIVENESS.UNAVAILABLE]);

/** رموز HTTP التي تُعتبر دليلًا قاطعًا على زوال المورد. */
const GONE_CODES = new Set([404, 410]);

/** رموز تعني عطلًا مؤقتًا في الخادم — لا حكم منها. */
const TRANSIENT_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** عبارات في نص الصفحة تدل على انتهاء الإعلان. */
const EXPIRED_MARKERS = [
  "انتهى الإعلان", "الإعلان منتهي", "تم البيع", "غير متوفر",
  "الإعلان غير موجود", "تم حذف الإعلان", "listing expired", "no longer available",
];

/** عدد المحاولات القاطعة المتتالية المطلوبة قبل السماح بالأرشفة. */
export const REQUIRED_CONFIRMATIONS = 2;

/**
 * يحوّل نتيجة فحص واحدة إلى حالة.
 * @param {{ok:boolean, status:number|null, error:string|null, body?:string}} probe
 */
export function classifyProbe(probe) {
  if (!probe) return { state: LIVENESS.CHECK_FAILED, reason: "no_probe_result" };

  // لا استجابة إطلاقًا = تعذّر التحقق، لا انتهاء.
  if (probe.status === null || probe.status === undefined) {
    return { state: LIVENESS.CHECK_FAILED, reason: probe.error ?? "network_error" };
  }

  if (GONE_CODES.has(probe.status)) {
    return { state: LIVENESS.EXPIRED, reason: `http_${probe.status}` };
  }

  if (TRANSIENT_CODES.has(probe.status)) {
    return { state: LIVENESS.CHECK_FAILED, reason: `transient_http_${probe.status}` };
  }

  if (probe.status >= 400) {
    // 4xx أخرى (401/403 مثلًا) ليست دليل انتهاء — قد تكون حماية وصول.
    return { state: LIVENESS.REVIEW_REQUIRED, reason: `http_${probe.status}` };
  }

  if (probe.ok && probe.body) {
    const text = String(probe.body).toLowerCase();
    const marker = EXPIRED_MARKERS.find((m) => text.includes(m.toLowerCase()));
    if (marker) return { state: LIVENESS.UNAVAILABLE, reason: `marker:${marker}` };
  }

  if (probe.ok) return { state: LIVENESS.ACTIVE, reason: `http_${probe.status}` };

  return { state: LIVENESS.CHECK_FAILED, reason: `unexpected_http_${probe.status}` };
}

/**
 * يجمع عدة محاولات في قرار واحد.
 *
 * قاعدة الحسم: الأرشفة تتطلب REQUIRED_CONFIRMATIONS محاولة قاطعة
 * بنفس الحالة، وألا تكون أي محاولة أعادت "active".
 */
export function decideLiveness(probes, { requiredConfirmations = REQUIRED_CONFIRMATIONS } = {}) {
  const states = (probes ?? []).map((p) => classifyProbe(p));

  if (!states.length) {
    return { state: LIVENESS.CHECK_FAILED, archivable: false, reason: "no_attempts", states };
  }

  // أي إشارة حياة واحدة تكفي لإبقاء الإعلان — الحياة تُرجَّح على الموت.
  if (states.some((s) => s.state === LIVENESS.ACTIVE)) {
    return { state: LIVENESS.ACTIVE, archivable: false, reason: "alive_signal", states };
  }

  if (states.some((s) => s.state === LIVENESS.REVIEW_REQUIRED)) {
    return {
      state: LIVENESS.REVIEW_REQUIRED, archivable: false,
      reason: states.find((s) => s.state === LIVENESS.REVIEW_REQUIRED).reason, states,
    };
  }

  for (const candidate of [LIVENESS.EXPIRED, LIVENESS.UNAVAILABLE]) {
    const matching = states.filter((s) => s.state === candidate);
    if (matching.length >= requiredConfirmations) {
      return {
        state: candidate, archivable: ARCHIVABLE.has(candidate),
        reason: matching[0].reason, confirmations: matching.length, states,
      };
    }
  }

  // إشارة قاطعة واحدة فقط ليست كافية — نطلب التأكيد في جولة لاحقة.
  const conclusive = states.find((s) => ARCHIVABLE.has(s.state));
  if (conclusive) {
    return {
      state: LIVENESS.REVIEW_REQUIRED, archivable: false,
      reason: `unconfirmed_${conclusive.state}`, confirmations: 1, states,
    };
  }

  return { state: LIVENESS.CHECK_FAILED, archivable: false, reason: "all_checks_failed", states };
}

/**
 * يفحص إعلانًا واحدًا بعدة محاولات.
 * الجالب محقون — لا شبكة مباشرة هنا، فالاختبار بلا إنترنت ممكن.
 *
 * @param {{source_url:string}} offer
 * @param {{probe:(url:string)=>Promise<object>}} deps
 */
export async function checkOffer(offer, { probe, attempts = REQUIRED_CONFIRMATIONS } = {}) {
  const results = [];
  for (let i = 0; i < attempts; i += 1) {
    try {
      results.push(await probe(offer.source_url));
    } catch (error) {
      results.push({ ok: false, status: null, error: error.message });
    }
    // توقف مبكر: إشارة حياة واحدة تكفي.
    if (results.at(-1)?.ok && classifyProbe(results.at(-1)).state === LIVENESS.ACTIVE) break;
  }

  const decision = decideLiveness(results);
  return { offer_id: offer.id ?? null, source_url: offer.source_url, ...decision };
}
