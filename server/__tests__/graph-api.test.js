import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createGraphApiFetcher, mapGraphPosts, probeGraphAccess, GraphApiError,
} from "../ingestion/fetchers/graph-api.js";
import { extract } from "../ingestion/adapters/muain-ababneh.js";
import { redact } from "../core/logger.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const mockFetch = (payload, { ok = true, status = 200 } = {}) => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok, status, json: async () => payload,
  });
  return globalThis.fetch;
};

const graphPost = (id, message) => ({
  id, message,
  permalink_url: `https://www.facebook.com/m.yn.babnh.babnh/posts/${id}`,
  created_time: "2026-08-15T09:12:00+0300",
});

// ===============================================================
// تحويل استجابة Graph
// ===============================================================
describe("mapGraphPosts", () => {
  it("يحوّل إلى الشكل الذي يتوقعه المحوّل", () => {
    const out = mapGraphPosts({ data: [graphPost("1", "ارض للبيع 500 متر")] });
    expect(out.data[0]).toMatchObject({
      id: "1", text: "ارض للبيع 500 متر",
      permalink: expect.stringContaining("m.yn.babnh.babnh"),
    });
  });

  it("يستبعد المنشور بلا نص أو بلا رابط", () => {
    const out = mapGraphPosts({
      data: [
        graphPost("1", "ارض للبيع"),
        { id: "2", permalink_url: "https://www.facebook.com/x/posts/2" }, // بلا نص
        { id: "3", message: "نص بلا رابط" },
      ],
    });
    expect(out.data).toHaveLength(1);
  });

  it("لا ينهار على استجابة فارغة", () => {
    expect(mapGraphPosts(null).data).toEqual([]);
    expect(mapGraphPosts({}).data).toEqual([]);
  });
});

// ===============================================================
// الجالب
// ===============================================================
describe("createGraphApiFetcher", () => {
  it("يرفض الإنشاء بلا توكن — لا وصول بلا تفويض", () => {
    expect(() => createGraphApiFetcher({ pageId: "x" })).toThrow(GraphApiError);
    expect(() => createGraphApiFetcher({ token: "t" })).toThrow(GraphApiError);
  });

  it("يضع التوكن في الترويسة لا في الرابط", async () => {
    const spy = mockFetch({ data: [graphPost("1", "ارض للبيع 500 متر")] });
    const fetcher = createGraphApiFetcher({ token: "SECRET_TOKEN", pageId: "page" });
    await fetcher.fetchPage();

    const [url, options] = spy.mock.calls[0];
    expect(String(url)).not.toContain("SECRET_TOKEN");
    expect(options.headers.authorization).toBe("Bearer SECRET_TOKEN");
  });

  it("يطلب أقل الحقول اللازمة فقط", async () => {
    const spy = mockFetch({ data: [] });
    await createGraphApiFetcher({ token: "t", pageId: "page" }).fetchPage();
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("fields=id%2Cmessage%2Cpermalink_url%2Ccreated_time");
  });

  it("مخرجاته تدخل المحوّل مباشرة", async () => {
    mockFetch({
      data: [graphPost("1001", "ارض للبيع من اراضي المغير ٣دونم وا٧١٦ متر سعر القطعه كامله ١٨الف وا٥٨٠دينار")],
    });
    const page = await createGraphApiFetcher({ token: "t", pageId: "page" }).fetchPage();
    const result = extract({ html: page.html });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].size).toBe("3716 م²");
    expect(result.offers[0].price).toBe("18580 JOD");
  });

  it("توكن منتهٍ (190) يُبلَّغ بوضوح", async () => {
    mockFetch({ error: { code: 190, message: "Error validating access token", type: "OAuthException" } },
      { ok: false, status: 401 });
    await expect(createGraphApiFetcher({ token: "t", pageId: "p" }).fetchPage())
      .rejects.toMatchObject({ name: "GraphApiError", code: 190 });
  });

  it("عطل الشبكة يُغلَّف ولا يتسرّب", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(createGraphApiFetcher({ token: "t", pageId: "p" }).fetchPage())
      .rejects.toBeInstanceOf(GraphApiError);
  });
});

// ===============================================================
// فحص نوع الهدف — صفحة أم حساب شخصي
// ===============================================================
describe("probeGraphAccess", () => {
  it("يقبل الصفحة (تحمل category)", async () => {
    mockFetch({ id: "123", name: "معين عبابنه", category: "Real Estate" });
    const r = await probeGraphAccess({ token: "t", pageId: "p" });
    expect(r.ok).toBe(true);
    expect(r.page.category).toBe("Real Estate");
  });

  it("⚠️ يرفض الحساب الشخصي — Graph لا يقرأ منشوراته إطلاقًا", async () => {
    mockFetch({ id: "123", name: "معين عبابنه" }); // بلا category
    const r = await probeGraphAccess({ token: "t", pageId: "p" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not_a_page");
  });

  it("يميّز التوكن غير الصالح عن غياب الصلاحية", async () => {
    mockFetch({ error: { code: 190, message: "bad token" } }, { ok: false, status: 401 });
    expect((await probeGraphAccess({ token: "t", pageId: "p" })).reason).toBe("invalid_token");

    mockFetch({ error: { code: 100, message: "unsupported" } }, { ok: false, status: 400 });
    expect((await probeGraphAccess({ token: "t", pageId: "p" })).reason)
      .toBe("not_a_page_or_no_access");
  });

  it("غياب التوكن يُبلَّغ ولا يرمي", async () => {
    expect((await probeGraphAccess({ pageId: "p" })).reason).toBe("missing_token");
  });
});

// ===============================================================
// الأمان
// ===============================================================
describe("أمان التوكن", () => {
  it("التوكن يُحجب من السجلات", () => {
    const out = redact({ FACEBOOK_PAGE_TOKEN: "EAAG123", authorization: "Bearer EAAG123" });
    expect(out.FACEBOOK_PAGE_TOKEN).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
  });

  it("لا وجود لتوكن فيسبوك في كود الواجهة", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

    const walk = (dir, acc = []) => {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full, acc);
        else if (/\.(js|jsx)$/.test(e)) acc.push(full);
      }
      return acc;
    };

    const offenders = walk(join(root, "src"))
      .filter((f) => /FACEBOOK_PAGE_TOKEN|graph\.facebook/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

// ===============================================================
// تطبيع رابط Supabase — حارس انحدار من أول تشغيل سحابي
// ===============================================================
describe("normalizeSupabaseUrl", () => {
  it("يزيل المسار والشرطة الزائدة", async () => {
    const { normalizeSupabaseUrl } = await import("../core/config.js");
    // سرّ SUPABASE_URL في GitHub حمل مسارًا زائدًا، فأنتج PostgREST
    // "Invalid path specified in request URL" وأسقط الجولة كاملة.
    for (const input of [
      "https://x.supabase.co/",
      "https://x.supabase.co/rest/v1",
      "  https://x.supabase.co/  ",
    ]) {
      expect(normalizeSupabaseUrl(input)).toBe("https://x.supabase.co");
    }
  });

  it("يترك الرابط السليم كما هو ويتحمل الفارغ", async () => {
    const { normalizeSupabaseUrl } = await import("../core/config.js");
    expect(normalizeSupabaseUrl("https://x.supabase.co")).toBe("https://x.supabase.co");
    expect(normalizeSupabaseUrl("")).toBeUndefined();
    expect(normalizeSupabaseUrl(null)).toBeUndefined();
  });
});
