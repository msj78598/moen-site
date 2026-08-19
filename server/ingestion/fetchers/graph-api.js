/**
 * جالب Facebook Graph API.
 *
 * ===== المسار المشروع الوحيد =====
 * قراءة منشورات صفحة فيسبوك آليًا لها طريق رسمي واحد: Graph API بتوكن
 * وصول للصفحة (Page Access Token) يمنحه مالكها. كل ما عداه — كشط
 * الواجهة، تسجيل دخول آلي، كوكيز — مخالف لشروط المنصة، ولم يُكتب هنا.
 *
 * ===== قيد جوهري يجب معرفته =====
 *   صفحة (Page)          -> /{id}/posts مدعوم بتوكن الصفحة        ✅
 *   حساب شخصي (Profile)  -> لا endpoint لقراءة المنشورات إطلاقًا   ❌
 *
 * أُزيلت قراءة منشورات الحسابات الشخصية من Graph API منذ الإصدار 2.x.
 * إن كان m.yn.babnh.babnh حسابًا شخصيًا لا صفحة، فلا مسار آلي مشروع
 * موجودًا أصلًا، والحل الوحيد تحويله إلى صفحة.
 *
 * ===== الأمان =====
 * التوكن يُقرأ من بيئة العامل فقط. لا يظهر في السجلات (logger.js يحجبه)
 * ولا يصل إلى المتصفح ولا إلى أي نموذج لغة.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** الحقول المطلوبة — أقل ما يلزم، لا نطلب بيانات لا نستخدمها. */
const POST_FIELDS = ["id", "message", "permalink_url", "created_time"].join(",");

export class GraphApiError extends Error {
  constructor(message, { code = null, type = null, status = null } = {}) {
    super(message);
    this.name = "GraphApiError";
    this.code = code;
    this.type = type;
    this.status = status;
  }
}

/**
 * يحوّل استجابة Graph إلى الشكل الذي يتوقعه محوّل معين.
 * مُصدَّرة ليُختبر التحويل بلا شبكة.
 */
export function mapGraphPosts(payload) {
  const posts = (payload?.data ?? []).map((post) => ({
    id: post.id,
    text: post.message ?? "",
    permalink: post.permalink_url ?? "",
    created_time: post.created_time ?? null,
  }));
  // المنشور بلا نص لا يحمل إعلانًا — يُستبعد مبكرًا.
  return { data: posts.filter((p) => p.text && p.permalink) };
}

/**
 * جالب Graph API.
 *
 * @param {object} options
 * @param {string} options.token    Page Access Token
 * @param {string} options.pageId   معرّف الصفحة أو اسم المستخدم
 * @param {number} [options.limit]
 */
export function createGraphApiFetcher({ token, pageId, limit = 25, timeoutMs = 20_000 } = {}) {
  if (!token) {
    throw new GraphApiError(
      "لا يوجد Page Access Token. اضبط FACEBOOK_PAGE_TOKEN في بيئة العامل."
    );
  }
  if (!pageId) throw new GraphApiError("معرّف الصفحة مفقود.");

  return {
    kind: "graph_api",

    /**
     * يتجاهل الرابط الممرَّر ويقرأ من Graph مباشرة.
     * السبب: المحوّل يمرّر رابط الصفحة العام، والمصدر الفعلي هو الـAPI.
     */
    async fetchPage() {
      const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(pageId)}/posts`);
      url.searchParams.set("fields", POST_FIELDS);
      url.searchParams.set("limit", String(limit));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          // التوكن في الترويسة لا في الرابط — حتى لا يظهر في سجلات الوسطاء.
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const err = payload?.error ?? {};
          // 190 = توكن منتهٍ أو غير صالح  ·  100 = طلب غير مدعوم (حساب شخصي غالبًا)
          throw new GraphApiError(
            err.message ?? `Graph API أعاد HTTP ${response.status}`,
            { code: err.code ?? null, type: err.type ?? null, status: response.status }
          );
        }

        return {
          url: `${GRAPH_BASE}/${pageId}/posts`,
          html: JSON.stringify(mapGraphPosts(payload)),
          fetchedAt: new Date().toISOString(),
        };
      } catch (error) {
        if (error instanceof GraphApiError) throw error;
        throw new GraphApiError(`تعذر الاتصال بـ Graph API: ${error.message}`);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * يفحص صلاحية التوكن ونوع الهدف قبل أي جولة.
 * يميّز بوضوح بين "توكن خاطئ" و"الهدف حساب شخصي لا صفحة".
 */
export async function probeGraphAccess({ token, pageId, timeoutMs = 15_000 } = {}) {
  if (!token) return { ok: false, reason: "missing_token", message: "لا يوجد توكن." };
  if (!pageId) return { ok: false, reason: "missing_page_id", message: "معرّف الصفحة مفقود." };

  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "id,name,category");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const err = payload?.error ?? {};
      const reason =
        err.code === 190 ? "invalid_token"
          : err.code === 100 ? "not_a_page_or_no_access"
            : "graph_error";
      return { ok: false, reason, message: err.message ?? `HTTP ${response.status}`, code: err.code };
    }

    // الصفحات تحمل category؛ غيابها مؤشر قوي على أن الهدف ليس صفحة.
    if (!payload?.category) {
      return {
        ok: false, reason: "not_a_page",
        message: "الهدف ليس صفحة — Graph API لا يقرأ منشورات الحسابات الشخصية.",
      };
    }

    return { ok: true, page: { id: payload.id, name: payload.name, category: payload.category } };
  } catch (error) {
    return { ok: false, reason: "network_error", message: error.message };
  } finally {
    clearTimeout(timer);
  }
}
