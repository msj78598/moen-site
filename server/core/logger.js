/**
 * تسجيل منظّم (structured logging).
 *
 * يحل محل console.log المتناثر. المخرجات JSON سطر لكل حدث حتى تكون
 * قابلة للتحليل لاحقًا بلا أدوات مراقبة مدفوعة.
 *
 * قاعدة إلزامية (المرحلة 19): لا يُكتب أي مفتاح أو سر في السجل أبدًا.
 * الحجب يتم هنا مركزيًا لا في كل موضع نداء.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/** مفاتيح تُحجب قيمتها دائمًا، بأي حالة أحرف. */
const SECRET_KEYS = [
  "password", "token", "access_token", "refresh_token", "apikey", "api_key",
  "servicerolekey", "service_role_key", "secret", "authorization", "cookie",
  "publishablekey", "publishable_key", "anon_key",
  // توكنات المنصات الخارجية
  "facebookpagetoken", "facebook_page_token", "pagetoken", "page_token",
  "accesstoken", "bearer",
];

/** أنماط تُحجب حتى لو ظهرت داخل نص حر. */
const SECRET_PATTERNS = [
  /sb_(publishable|secret)_[A-Za-z0-9_-]+/g,
  /EAA[A-Za-z0-9]{8,}/g,                    // توكنات فيسبوك تبدأ بـ EAA
  /Bearer\s+[A-Za-z0-9._-]{12,}/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];

function redactString(value) {
  let output = value;
  for (const pattern of SECRET_PATTERNS) output = output.replace(pattern, "[REDACTED]");
  return output;
}

export function redact(value, depth = 0) {
  if (depth > 6) return "[deep]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object") return value;
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));

  const output = {};
  for (const [key, val] of Object.entries(value)) {
    output[key] = SECRET_KEYS.includes(key.toLowerCase().replace(/[^a-z_]/g, ""))
      ? "[REDACTED]"
      : redact(val, depth + 1);
  }
  return output;
}

function emit(level, message, fields, minLevel) {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...redact(fields ?? {}),
  };
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(line)}\n`);
}

export function createLogger(scope, { level = "info", base = {} } = {}) {
  const bound = { scope, ...base };
  const make = (lvl) => (message, fields) => emit(lvl, message, { ...bound, ...fields }, level);

  return {
    debug: make("debug"),
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
    /** يشتق مسجّلًا فرعيًا يحمل نفس السياق (مثلاً runId). */
    child(extra) {
      return createLogger(scope, { level, base: { ...bound, ...extra } });
    },
  };
}
