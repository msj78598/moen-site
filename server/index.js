/**
 * نقطة دخول العامل (worker).
 *
 * التشغيل:
 *   node --env-file=.env.worker server/index.js              # يشغّل الجدولة
 *   node --env-file=.env.worker server/index.js run monitor  # مهمة واحدة ثم يخرج
 *   node --env-file=.env.worker server/index.js list         # يعرض الوكلاء والأدوات والمهام
 *
 * هذا العامل منفصل تمامًا عن الموقع. الموقع يظل static على Vercel
 * ولا يعتمد على تشغيل هذا العامل إطلاقًا.
 */

import { config, validateConfig, hasWriteCredentials } from "./core/config.js";
import { createLogger } from "./core/logger.js";
import { getDb } from "./core/db.js";
import { createAudit } from "./core/audit.js";
import { listTools } from "./core/tools.js";
import { listAgents } from "./core/agent.js";
import { getLLMProvider } from "./ai/llm-provider.js";
import { registerJob, runJob, listJobs, startScheduler } from "./scheduler/scheduler.js";

// الاستيراد يسجّل الأدوات ثم الوكلاء — الترتيب مهم: الوكيل يتحقق من وجود أدواته.
import "./tools/read-tools.js";
import "./agents/monitor.js";
import { registerAllJobs } from "./jobs/index.js";

const logger = createLogger("worker", { level: config.worker.logLevel });

async function buildContext() {
  const db = getDb();
  return {
    db,
    logger,
    audit: createAudit({ db, logger }),
    dryRun: config.worker.dryRun,
    // بالمفتاح العام تحجب RLS الصفوف المؤرشفة، فرؤية العامل ناقصة.
    // الوكلاء يعلنون هذا بدل أن يبلّغوا إحصاءات مضلّلة.
    limitedVisibility: !hasWriteCredentials(),
  };
}

async function reportEnvironment() {
  const provider = await getLLMProvider({ logger });
  const available = await provider.isAvailable();

  logger.info("environment", {
    supabaseUrl: config.supabase.url,
    writeMode: hasWriteCredentials() ? "service_role" : "read_only",
    dryRun: config.worker.dryRun,
    timeZone: config.worker.timeZone,
    llmProvider: provider.name,
    llmAvailable: available,
    llmModel: available ? config.llm.model : null,
  });

  // القاعدة: غياب الذكاء الاصطناعي ليس عطلًا.
  if (!available) {
    logger.warn("ai_unavailable", {
      provider: provider.name,
      reason: provider.reason ?? "غير مضبوط",
      impact: "النظام يعمل بالمسار الحتمي بالكامل. لا وظيفة معطّلة في Sprint 2.",
    });
    if (config.llm.required) {
      logger.error("ai_required_but_missing", { hint: "LLM_REQUIRED=false للسماح بالعمل بدونه" });
      process.exit(1);
    }
  }
}

async function main() {
  const problems = validateConfig();
  if (problems.length) {
    logger.error("config_invalid", { problems });
    process.exit(1);
  }

  registerAllJobs();
  const [command, argument] = process.argv.slice(2);

  if (command === "list") {
    logger.info("registry", {
      agents: listAgents(),
      tools: listTools(),
      jobs: listJobs(),
    });
    return;
  }

  await reportEnvironment();
  const ctx = await buildContext();

  if (command === "run") {
    if (!argument) {
      logger.error("missing_job_name", { available: listJobs().map((j) => j.name) });
      process.exit(1);
    }
    const report = await runJob(argument, ctx);
    logger.info("run_complete", report);
    process.exit(report.status === "failure" ? 1 : 0);
  }

  startScheduler({ timeZone: config.worker.timeZone, logger, ctx });
  logger.info("worker_ready", { jobs: listJobs() });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      logger.info("worker_stopping", { signal });
      process.exit(0);
    });
  }
}

main().catch((error) => {
  logger.error("worker_crashed", { error: error.message, stack: error.stack?.split("\n").slice(0, 4) });
  process.exit(1);
});

export { registerJob };
