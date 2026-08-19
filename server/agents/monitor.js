/**
 * وكيل المراقبة — أول وكيل عامل فعليًا.
 *
 * Identity:        monitor
 * Purpose:         يرصد صحة البيانات والموقع ويبلّغ. لا يصلح شيئًا.
 * Level:           1 (قراءة فقط)
 * Allowed Tools:   search_properties, search_external_offers, count_by_status, check_url_liveness
 * Forbidden Tools: كل ما يكتب — وهو مفروض بنيويًا لأن مستواه 1
 * Failure Policy:  continue (فشل فحص واحد لا يوقف بقية الفحوصات)
 * Retry Policy:    محاولتان، تراجع 2 ثانية
 * Audit Policy:    يسجّل كل نداء أداة + بداية ونهاية التشغيل
 * LLM:             لا يستخدمه إطلاقًا — كل فحوصاته حتمية
 *
 * لماذا هذا الوكيل أولًا: أعلى عائد وأدنى خطر. لا يكتب شيئًا، ويكشف
 * فورًا الأعطال التي أثبتها التدقيق (توقف الكشط، انهيار حصيلة العروض).
 */

import { z } from "zod";
import { defineAgent, LEVEL } from "../core/agent.js";
// الوكيل مسؤول عن ضمان تسجيل أدواته: defineAgent يتحقق من وجودها عند التعريف،
// فلا يمكن تعريف وكيل يشير إلى أداة غير موجودة.
import "../tools/read-tools.js";

const findingSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]),
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** حد اعتُمد من الواقع: التدقيق أظهر انهيارًا من ~86 عرضًا إلى 8. */
const STALE_DAYS_WARNING = 3;
const STALE_DAYS_CRITICAL = 7;

export function daysSince(dateText, now = new Date()) {
  if (!dateText) return null;
  const then = new Date(dateText);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now - then) / 86_400_000);
}

/** منطق التقييم منفصل عن الشبكة ليكون قابلًا للاختبار وحده. */
export function evaluateFreshness(latestCheckedAt, now = new Date()) {
  const age = daysSince(latestCheckedAt, now);
  if (age === null) {
    return { severity: "critical", code: "no_offer_dates", message: "لا يوجد أي تاريخ فحص للعروض الخارجية." };
  }
  if (age >= STALE_DAYS_CRITICAL) {
    return {
      severity: "critical", code: "offers_stale",
      message: `العروض الخارجية لم تُحدَّث منذ ${age} يومًا — الكشط متوقف على الأرجح.`,
      details: { ageDays: age },
    };
  }
  if (age >= STALE_DAYS_WARNING) {
    return {
      severity: "warning", code: "offers_aging",
      message: `مرّ ${age} أيام على آخر تحديث للعروض الخارجية.`,
      details: { ageDays: age },
    };
  }
  return { severity: "info", code: "offers_fresh", message: `العروض محدّثة (${age} يوم).`, details: { ageDays: age } };
}

/** يكشف انهيار الحصيلة: نسبة المنشور إلى الإجمالي. */
export function evaluateArchiveRatio({ published, archived }) {
  const total = published + archived;
  if (total === 0) {
    return { severity: "critical", code: "no_offers", message: "لا توجد أي عروض خارجية إطلاقًا." };
  }
  const archivedPct = Math.round((archived / total) * 100);
  if (archivedPct >= 80) {
    return {
      severity: "critical", code: "mass_archive",
      message: `${archivedPct}% من العروض الخارجية مؤرشفة (${archived} من ${total}). مؤشر قوي على فشل جولة كشط ناقصة.`,
      details: { published, archived, archivedPct },
    };
  }
  if (archivedPct >= 50) {
    return {
      severity: "warning", code: "high_archive_ratio",
      message: `${archivedPct}% من العروض مؤرشفة.`,
      details: { published, archived, archivedPct },
    };
  }
  return { severity: "info", code: "archive_ratio_ok", message: `نسبة الأرشفة ${archivedPct}%.` };
}

export const monitorAgent = defineAgent({
  name: "monitor",
  purpose: "يرصد صحة البيانات وروابط العروض ويبلّغ عن المشاكل. لا يعدّل شيئًا.",
  level: LEVEL.READ,
  usesLLM: false,
  allowedTools: [
    "search_properties",
    "search_external_offers",
    "count_by_status",
    "check_url_liveness",
  ],
  forbiddenTools: [],
  inputSchema: z.object({
    checkLinks: z.boolean().default(true),
    maxLinksToCheck: z.number().int().min(0).max(50).default(10),
  }),
  outputSchema: z.object({
    findings: z.array(findingSchema),
    stats: z.record(z.string(), z.unknown()),
  }),
  failurePolicy: { onError: "continue", maxConsecutiveFailures: 3 },
  retryPolicy: { maxAttempts: 2, backoffMs: 2_000 },

  async run({ checkLinks, maxLinksToCheck }, ctx) {
    const findings = [];
    const stats = {};
    stats.limitedVisibility = Boolean(ctx.limitedVisibility);

    // إعلان صريح لحدود الرؤية قبل أي رقم — الشفافية أهم من رقم يبدو مطمئنًا.
    if (ctx.limitedVisibility) {
      findings.push({
        severity: "warning",
        code: "limited_visibility",
        message:
          "العامل يعمل بمفتاح القراءة العام، وRLS تحجب الصفوف المؤرشفة. " +
          "نسب الأرشفة أدناه ناقصة ولا يصح الاعتماد عليها.",
      });
    }

    // 1) توزيع الحالات في العروض الخارجية
    const offerCounts = await ctx.tool("count_by_status", { table: "external_offers" });
    const published = offerCounts.counts.published ?? 0;
    const archived = offerCounts.counts.archived ?? 0;
    stats.externalOffers = offerCounts.counts;

    // لا نُطلق إنذار الأرشفة الجماعية إن كانت الرؤية ناقصة أصلًا.
    if (!ctx.limitedVisibility) {
      findings.push(evaluateArchiveRatio({ published, archived }));
    }

    // 2) عروض المكتب
    const propCounts = await ctx.tool("count_by_status", { table: "properties" });
    stats.properties = propCounts.counts;
    const totalProps = Object.values(propCounts.counts).reduce((a, b) => a + b, 0);
    if (totalProps === 0) {
      findings.push({
        severity: "critical", code: "no_properties",
        message: "لا توجد أي عروض مكتب في قاعدة البيانات.",
      });
    }

    // 3) حداثة العروض
    const offers = await ctx.tool("search_external_offers", { status: "published", limit: 200 });
    const latest = offers.rows.map((r) => r.checked_at).filter(Boolean).sort().at(-1) ?? null;
    stats.latestCheckedAt = latest;
    findings.push(evaluateFreshness(latest));

    // 4) فحص الروابط — عيّنة محدودة احترامًا للمصادر
    if (checkLinks && maxLinksToCheck > 0) {
      const sample = offers.rows.filter((r) => r.source_url).slice(0, maxLinksToCheck);
      const broken = [];
      for (const row of sample) {
        const result = await ctx.tool("check_url_liveness", { url: row.source_url });
        if (!result.ok) broken.push({ id: row.id, url: row.source_url, status: result.status, error: result.error });
      }
      stats.linksChecked = sample.length;
      stats.linksBroken = broken.length;

      if (broken.length) {
        findings.push({
          severity: broken.length >= sample.length / 2 ? "critical" : "warning",
          code: "broken_source_links",
          message: `${broken.length} من ${sample.length} رابط مصدر لا يستجيب.`,
          details: { broken: broken.slice(0, 10) },
        });
      } else {
        findings.push({
          severity: "info", code: "links_ok",
          message: `كل الروابط المفحوصة تستجيب (${sample.length}).`,
        });
      }
    }

    const worst = findings.some((f) => f.severity === "critical")
      ? "critical"
      : findings.some((f) => f.severity === "warning") ? "warning" : "info";
    ctx.logger?.info?.("monitor_summary", { worst, findings: findings.length, stats });

    return { findings, stats };
  },
});
