/**
 * مزوّد Ollama — تشغيل محلي بالكامل.
 *
 * لا مفاتيح، لا اشتراك، ولا بيانات تغادر الخادم.
 * إن لم يكن Ollama يعمل، isAvailable() تُرجع false ويبقى النظام يعمل حتميًا.
 *
 * تبديل النموذج: LLM_MODEL=... — بلا تعديل كود.
 */

const AVAILABILITY_TTL_MS = 30_000;

export function createOllamaProvider({ baseUrl, model, timeoutMs }) {
  let lastCheck = 0;
  let lastResult = false;

  async function request(path, body, signalTimeout = timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), signalTimeout);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Ollama ${path} -> HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: "ollama",
    model,

    /** نتيجة مخبّأة 30 ثانية حتى لا نفحص عند كل نداء. */
    async isAvailable() {
      const now = Date.now();
      if (now - lastCheck < AVAILABILITY_TTL_MS) return lastResult;
      lastCheck = now;
      try {
        const tags = await request("/api/tags", null, 3_000);
        const models = (tags?.models ?? []).map((m) => m.name);
        // الاسم قد يكون بلا وسم النسخة (qwen2.5:7b مقابل qwen2.5:7b-instruct)
        lastResult = models.some((m) => m === model || m.startsWith(model.split(":")[0]));
        if (!lastResult) {
          this.reason = `النموذج "${model}" غير مثبّت. المتوفر: ${models.join(", ") || "لا شيء"}`;
        }
      } catch (error) {
        lastResult = false;
        this.reason = `تعذر الاتصال بـ Ollama على ${baseUrl}: ${error.message}`;
      }
      return lastResult;
    },

    async complete({ system, prompt, temperature = 0.2, maxTokens }) {
      const data = await request("/api/chat", {
        model,
        stream: false,
        options: { temperature, ...(maxTokens ? { num_predict: maxTokens } : {}) },
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
      });
      return { text: data?.message?.content ?? "", model };
    },

    /**
     * استخراج JSON مقيّد بمخطط.
     * format=json يجبر النموذج على إخراج JSON صالح، لكن الضمان الحقيقي
     * هو تحقق zod بعده — لا نثق بالنموذج.
     */
    async extractJson({ system, prompt, schema }) {
      const data = await request("/api/chat", {
        model,
        stream: false,
        format: "json",
        options: { temperature: 0 },
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
      });

      const raw = data?.message?.content ?? "";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        return { data: null, raw, model, error: `ناتج ليس JSON صالحًا: ${error.message}` };
      }

      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          return { data: null, raw, model, error: "الناتج لا يطابق المخطط", issues: result.error.issues };
        }
        return { data: result.data, raw, model };
      }
      return { data: parsed, raw, model };
    },
  };
}
