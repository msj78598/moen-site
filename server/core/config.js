/**
 * إعدادات العامل (worker).
 *
 * قاعدة أمنية: SUPABASE_SERVICE_ROLE_KEY يُقرأ هنا فقط، ولا يُمرَّر أبدًا
 * إلى أي مزوّد نماذج ولا يظهر في أي سجل. راجع server/core/logger.js.
 *
 * التحميل: node --env-file=.env.worker server/index.js
 * (Node 24 يدعم --env-file أصلًا، فلا حاجة لحزمة dotenv.)
 */

function read(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function bool(name, fallback = false) {
  const value = read(name);
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function int(name, fallback) {
  const value = Number(read(name));
  return Number.isFinite(value) ? value : fallback;
}

export const config = Object.freeze({
  supabase: {
    url: read("SUPABASE_URL") ?? read("VITE_SUPABASE_URL"),
    serviceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
    publishableKey: read("SUPABASE_PUBLISHABLE_KEY") ?? read("VITE_SUPABASE_ANON_KEY"),
  },

  llm: {
    // "ollama" | "none" — أي مزوّد جديد يُضاف في server/ai/providers/
    provider: read("LLM_PROVIDER", "none"),
    baseUrl: read("LLM_BASE_URL", "http://127.0.0.1:11434"),
    model: read("LLM_MODEL", "qwen2.5:7b-instruct"),
    timeoutMs: int("LLM_TIMEOUT_MS", 60_000),
    // النظام يجب أن يعمل بدون ذكاء اصطناعي. هذا يمنع أي انهيار عند غياب النموذج.
    required: bool("LLM_REQUIRED", false),
  },

  /**
   * فيسبوك — المسار الرسمي الوحيد لقراءة منشورات صفحة.
   * التوكن يُقرأ هنا فقط، ولا يصل إلى المتصفح ولا إلى أي نموذج لغة.
   * غيابه لا يُعطّل النظام: المصدر يبقى محجوبًا ببوابة الإذن.
   */
  facebook: {
    pageToken: read("FACEBOOK_PAGE_TOKEN"),
    pageId: read("FACEBOOK_PAGE_ID", "m.yn.babnh.babnh"),
  },

  worker: {
    timeZone: read("RUN_TIME_ZONE", "Asia/Riyadh"),
    // dry-run: الوكلاء يحسبون ويسجّلون لكن لا يكتبون شيئًا.
    dryRun: bool("WORKER_DRY_RUN", false),
    defaultJobTimeoutMs: int("JOB_TIMEOUT_MS", 120_000),
    logLevel: read("LOG_LEVEL", "info"),
  },
});

/** يتحقق من الحد الأدنى للتشغيل ويُرجع قائمة بالمشاكل بدل أن يرمي فورًا. */
export function validateConfig() {
  const problems = [];
  if (!config.supabase.url) problems.push("SUPABASE_URL مفقود");
  if (!config.supabase.serviceRoleKey && !config.supabase.publishableKey) {
    problems.push("لا يوجد أي مفتاح Supabase (service role أو publishable)");
  }
  return problems;
}

/**
 * هل يملك العامل صلاحية الكتابة؟ بدون service role يعمل بوضع القراءة فقط.
 *
 * تنبيه مهم اكتُشف من تشغيل حقيقي: بالمفتاح العام تحجب RLS الصفوف
 * المؤرشفة، فيرى العامل جزءًا من الحقيقة فقط. أي وكيل يعتمد على
 * إحصاءات شاملة يجب أن يعلن هذا القصور بدل أن يبلّغ رقمًا مضلّلًا.
 */
export function hasWriteCredentials() {
  return Boolean(config.supabase.serviceRoleKey);
}
