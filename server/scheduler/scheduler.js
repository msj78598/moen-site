/**
 * الجدولة.
 *
 * الكود هو الذي يقرر متى تعمل المهمة — لا نموذج لغة. (Traditional Code = Control)
 *
 * كل مهمة تلتزم بما يلي:
 *   - idempotent: إعادة التشغيل لا تُنتج أثرًا مزدوجًا
 *   - قفل: لا تعمل نسختان في الوقت ذاته
 *   - مهلة: لا تعلّق إلى الأبد
 *   - إعادة محاولة محدودة مع تراجع أسّي
 *   - تسجيل البداية والنهاية والنجاح والفشل
 *
 * القفل داخل العملية (in-process) — وهو الصحيح هنا لأن العامل عملية واحدة.
 * لا حاجة لـ Redis. إن تعددت العمليات لاحقًا يُنقل القفل إلى جدول في Postgres.
 */

import cron from "node-cron";
import { randomUUID } from "node:crypto";

const jobs = new Map();
const running = new Set();

export class JobTimeoutError extends Error {
  constructor(name, ms) {
    super(`انتهت مهلة المهمة "${name}" بعد ${ms}ms`);
    this.name = "JobTimeoutError";
  }
}

/**
 * @param {object} spec
 * @param {string} spec.name
 * @param {string} spec.description
 * @param {string} [spec.schedule]    تعبير cron
 * @param {number} [spec.timeoutMs]
 * @param {number} [spec.maxAttempts]
 * @param {Function} spec.handler     (ctx) => result
 */
export function registerJob(spec) {
  for (const key of ["name", "description", "handler"]) {
    if (!spec[key]) throw new Error(`تعريف المهمة ناقص: ${key}`);
  }
  if (jobs.has(spec.name)) throw new Error(`المهمة "${spec.name}" مسجّلة مسبقًا.`);

  jobs.set(spec.name, {
    timeoutMs: 120_000,
    maxAttempts: 2,
    backoffMs: 5_000,
    enabled: true,
    ...spec,
  });
  return spec.name;
}

export function listJobs() {
  return [...jobs.values()].map(({ name, description, schedule, enabled }) => ({
    name, description, schedule: schedule ?? "(يدوي)", enabled,
  }));
}

export function _resetJobs() {
  jobs.clear();
  running.clear();
}

async function withTimeout(promise, ms, name) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new JobTimeoutError(name, ms)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * يشغّل مهمة مرة واحدة مع كل الضمانات.
 * يُرجع تقريرًا بدل أن يرمي — الفشل حالة متوقعة لا استثناء.
 */
export async function runJob(name, baseCtx = {}) {
  const job = jobs.get(name);
  if (!job) throw new Error(`مهمة غير معروفة: "${name}"`);

  // القفل — منع التشغيل المتزامن
  if (running.has(name)) {
    baseCtx.logger?.warn?.("job_skipped_locked", { job: name });
    return { job: name, status: "skipped", reason: "نسخة أخرى قيد التشغيل" };
  }
  running.add(name);

  const runId = randomUUID();
  const logger = baseCtx.logger?.child?.({ job: name, runId }) ?? baseCtx.logger;
  const startedAt = Date.now();
  logger?.info?.("job_started", { attempt: 1 });

  let lastError = null;

  try {
    for (let attempt = 1; attempt <= job.maxAttempts; attempt += 1) {
      try {
        const result = await withTimeout(
          Promise.resolve(job.handler({ ...baseCtx, logger, runId, jobName: name })),
          job.timeoutMs,
          name
        );

        const durationMs = Date.now() - startedAt;
        logger?.info?.("job_succeeded", { attempt, durationMs });
        return { job: name, runId, status: "success", attempt, durationMs, result };
      } catch (error) {
        lastError = error;
        logger?.warn?.("job_attempt_failed", {
          attempt, error: error.message, willRetry: attempt < job.maxAttempts,
        });
        if (attempt < job.maxAttempts) {
          await new Promise((r) => setTimeout(r, job.backoffMs * attempt));
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    logger?.error?.("job_failed", { error: lastError?.message, durationMs });
    return {
      job: name, runId, status: "failure",
      attempts: job.maxAttempts, durationMs, error: lastError?.message ?? "سبب غير معروف",
    };
  } finally {
    running.delete(name);
  }
}

/** يبدأ كل المهام التي تملك تعبير cron. */
export function startScheduler({ timeZone, logger, ctx = {} }) {
  const started = [];

  for (const job of jobs.values()) {
    if (!job.schedule || !job.enabled) continue;
    if (!cron.validate(job.schedule)) {
      logger?.error?.("invalid_cron", { job: job.name, schedule: job.schedule });
      continue;
    }
    cron.schedule(job.schedule, () => { runJob(job.name, { ...ctx, logger }); }, { timezone: timeZone });
    started.push({ name: job.name, schedule: job.schedule });
  }

  logger?.info?.("scheduler_started", { timeZone, jobs: started });
  return started;
}
