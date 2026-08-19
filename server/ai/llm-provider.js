/**
 * تجريد مزوّد نماذج اللغة.
 *
 * الهدف: ألا يعرف أي وكيل اسم نموذج أو مزوّد. تبديل النموذج = تغيير
 * متغيّر بيئة واحد، بلا تعديل سطر في منطق العمل.
 *
 * قاعدتان ملزمتان:
 *   1) النظام يجب أن يعمل بدون ذكاء اصطناعي إطلاقًا.
 *      إن لم يتوفر النموذج، يعود كل شيء إلى المسار الحتمي ويُسجَّل
 *      أن الذكاء غير متاح — ولا ينهار شيء.
 *   2) المزوّد لا يستقبل أي مفتاح ولا عميل قاعدة بيانات. نص يدخل، نص يخرج.
 */

import { config } from "../core/config.js";

/**
 * العقد الذي يلتزم به كل مزوّد:
 *
 *   isAvailable(): Promise<boolean>
 *   complete({ system, prompt, temperature, maxTokens }): Promise<{ text, model }>
 *   extractJson({ system, prompt, schema }): Promise<{ data, raw, model }>
 *   name: string
 */

export class LLMUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "LLMUnavailableError";
    this.cause = cause;
  }
}

let cached = null;

export async function getLLMProvider({ logger } = {}) {
  if (cached) return cached;

  const kind = String(config.llm.provider || "none").toLowerCase();

  if (kind === "none") {
    const { createUnavailableProvider } = await import("./providers/unavailable.js");
    cached = createUnavailableProvider("LLM_PROVIDER=none");
  } else if (kind === "ollama") {
    const { createOllamaProvider } = await import("./providers/ollama.js");
    cached = createOllamaProvider(config.llm);
  } else {
    // مزوّد غير معروف لا يوقف النظام — يعطّل الذكاء فقط.
    const { createUnavailableProvider } = await import("./providers/unavailable.js");
    cached = createUnavailableProvider(`مزوّد غير معروف: ${kind}`);
    logger?.warn?.("مزوّد نماذج غير معروف — تم التحويل إلى الوضع الحتمي", { provider: kind });
  }

  return cached;
}

/** للاختبارات: حقن مزوّد بديل. */
export function _setProvider(provider) {
  cached = provider;
}

/**
 * ينفّذ مسار الذكاء إن توفّر، وإلا ينفّذ المسار الحتمي.
 * هذا هو النمط الذي يجب أن يستخدمه كل وكيل — لا استدعاء مباشر للمزوّد.
 *
 * @param {object} opts
 * @param {Function} opts.deterministic  المسار الأساسي — يُجرَّب أولًا دائمًا
 * @param {Function} [opts.withLLM]      يُستدعى فقط إن فشل الحتمي وتوفّر النموذج
 */
export async function withLLMFallback({ deterministic, withLLM, logger, onFallback }) {
  const result = await deterministic();
  if (result?.ok !== false) return { ...result, usedLLM: false };

  if (!withLLM) return { ...result, usedLLM: false };

  const provider = await getLLMProvider({ logger });
  const available = await provider.isAvailable();

  if (!available) {
    logger?.warn?.("ai_unavailable: تعذر استخدام النموذج، بقي الناتج حتميًا", {
      provider: provider.name, reason: provider.reason ?? null,
    });
    return { ...result, usedLLM: false, aiUnavailable: true };
  }

  onFallback?.();
  const enhanced = await withLLM(provider);
  return { ...enhanced, usedLLM: true };
}
