/**
 * الجالب (Fetch).
 *
 * تجريد مقصود: خط الاستيعاب لا يعرف من أين تأتي الصفحة.
 *   - fixtureFetcher : بيانات محلية مصنوعة يدويًا — للتطوير والاختبار
 *   - httpFetcher    : الشبكة الحقيقية — لا يُستخدم في Sprint 2
 *
 * ⚠️ Sprint 2 لا ينفّذ أي جلب حقيقي. httpFetcher مكتوب وجاهز لكنه
 *    محكوم ببوابة المصادر: لن يُستدعى ما لم يصبح مصدر granted+enabled.
 *
 * لاحقًا يمكن إضافة playwrightFetcher لمصدر يحتاج JavaScript، بلا تعديل
 * أي سطر في بقية الخط.
 */

export class FetchError extends Error {
  constructor(message, { status = null, cause } = {}) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.cause = cause;
  }
}

const USER_AGENT = "MoenRealEstateBot/1.0 (+https://moen-site.vercel.app)";

/**
 * جالب شبكي حقيقي — يحترم المهلة ويعرّف نفسه بوضوح.
 * غير مستخدم في Sprint 2.
 */
export function createHttpFetcher({ timeoutMs = 20_000 } = {}) {
  return {
    kind: "http",
    async fetchPage(url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new FetchError(`الجلب فشل: HTTP ${response.status}`, { status: response.status });
        }
        return { url, html: await response.text(), fetchedAt: new Date().toISOString() };
      } catch (error) {
        if (error instanceof FetchError) throw error;
        throw new FetchError(`تعذر جلب ${url}: ${error.message}`, { cause: error });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * جالب من بيانات محلية. لا يلمس الشبكة إطلاقًا.
 * هذا هو الجالب المستخدم في Sprint 2 وفي كل الاختبارات.
 *
 * @param {Record<string,string>} pages  خريطة url -> html
 */
export function createFixtureFetcher(pages, { fetchedAt = "2026-08-19T00:00:00.000Z" } = {}) {
  return {
    kind: "fixture",
    async fetchPage(url) {
      const html = pages?.[url];
      if (html === undefined) {
        throw new FetchError(`لا توجد بيانات محلية للرابط: ${url}`, { status: 404 });
      }
      return { url, html, fetchedAt };
    },
  };
}
