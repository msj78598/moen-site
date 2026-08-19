import { describe, it, expect, vi } from "vitest";
import {
  classifyPost, extractSize, extractPrice, extractPhone, extractLocation,
  extractType, extractTitle, postToOffer, isAllowedPath, PAGE_HANDLE,
} from "../ingestion/adapters/muain-ababneh.js";
import { getAdapter, listAdapters } from "../ingestion/adapters/index.js";
import { runIngestion, RUN_STATUS } from "../ingestion/pipeline.js";
import { createFixtureFetcher } from "../ingestion/fetcher.js";
import { evaluateSource, BLOCK_REASON } from "../ingestion/permission-gate.js";
import { sourceConfig, SOURCE_CLASS } from "../sources/registry.js";
import { SOURCE_SEED } from "../sources/seed.js";
import { canonicalUrl, dedupe } from "../ingestion/dedupe.js";
import {
  POSTS, FEED_PAGES, EMPTY_FEED, BROKEN_FEED,
  GRANTED_MUAIN_SOURCE, PENDING_MUAIN_SOURCE, DISABLED_MUAIN_SOURCE,
} from "../ingestion/__fixtures__/muain-ababneh.js";
import { PAGES as DALEEL_PAGES, GRANTED_SOURCE as DALEEL_SOURCE }
  from "../ingestion/__fixtures__/daleelaqar.js";

// ===============================================================
// المنشور المرجعي — القيم التي حدّدها صاحب المشروع
// ===============================================================
describe("المنشور المرجعي", () => {
  const post = POSTS.landFull;

  it("يُصنَّف إعلانًا عقاريًا", () => {
    expect(classifyPost(post.text).isProperty).toBe(true);
  });

  it('المساحة: "٣دونم وا٧١٦ متر" = 3716 م²', () => {
    expect(extractSize(post.text).m2).toBe(3716);
  });

  it("سعر المتر = 5", () => {
    expect(extractPrice(post.text).perM2).toBe(5);
  });

  it('السعر الإجمالي: "١٨الف وا٥٨٠دينار" = 18580', () => {
    // ⚠️ حارس انحدار: \b لا يعمل مع الحروف العربية في JavaScript،
    // وكان ذلك يقرأ هذا الرقم 18000.
    expect(extractPrice(post.text).total).toBe(18580);
  });

  it("العملة JOD", () => {
    expect(extractPrice(post.text).currency).toBe("JOD");
  });

  it("النوع أرض", () => {
    expect(extractType(post.text).category).toBe("land");
  });

  it("الموقع يشمل إربد والمغير وراحوب وحوض البركة", () => {
    const loc = extractLocation(post.text);
    for (const part of ["اربد", "المغير", "راحوب", "حوض البركه"]) {
      expect(loc, `${part} مفقود`).toContain(part);
    }
  });

  it("الهاتف 0796181720", () => {
    expect(extractPhone(post.text)).toBe("0796181720");
  });

  it("العنوان من نص المنشور لا مُولَّد", () => {
    const title = extractTitle(post.text);
    expect(title).toBeTruthy();
    expect(post.text).toContain(title);
  });

  it("كل قيمة مسنَدة إلى موضعها في النص", () => {
    const { offer } = postToOffer(post);
    expect(offer.evidence.size).toContain("دونم");
    expect(offer.evidence.price.total).toContain("18580");
  });
});

// ===============================================================
// صيغ أخرى
// ===============================================================
describe("صيغ الأرقام والأسعار", () => {
  it("سعر المتر وحده بلا إجمالي", () => {
    const p = extractPrice(POSTS.landPerMeterOnly.text);
    expect(p.perM2).toBe(12);
    expect(p.total).toBeNull();
  });

  it("لا سعر إطلاقًا -> null ثم «السعر عند التواصل»", () => {
    const p = extractPrice(POSTS.landNoPrice.text);
    expect(p.total).toBeNull();
    expect(p.perM2).toBeNull();
    const { offer } = postToOffer(POSTS.landNoPrice);
    expect(offer.price).toBe("");
  });

  it("لا مساحة -> null ولا رقم مخترع", () => {
    expect(extractSize(POSTS.apartmentNoSize.text).m2).toBeNull();
    const { offer } = postToOffer(POSTS.apartmentNoSize);
    expect(offer.size).toBe("");
  });

  it("«دونم ونص» غامض -> لا يُخمَّن نصف الدونم", () => {
    const s = extractSize("دونم ونص");
    expect(s.m2).toBeNull();
  });

  it("سعر إجمالي بالألف: «٤٥ الف» = 45000", () => {
    expect(extractPrice(POSTS.apartmentNoSize.text).total).toBe(45000);
  });
});

// ===============================================================
// المنشورات غير العقارية
// ===============================================================
describe("المنشورات غير العقارية", () => {
  it("المنشور الشخصي لا يتحول إلى عرض", () => {
    const { offer, skipped, reason } = postToOffer(POSTS.personal);
    expect(offer).toBeNull();
    expect(skipped).toBe(true);
    expect(reason).toBe("no_property_term");
  });

  it("منشور اجتماعي فيه أرقام لا يتحول إلى عرض", () => {
    expect(postToOffer(POSTS.socialWithNumbers).offer).toBeNull();
  });
});

// ===============================================================
// النطاق والتكرار
// ===============================================================
describe("النطاق والتكرار", () => {
  it("النطاق صفحة واحدة لا فيسبوك كله", () => {
    expect(isAllowedPath(`https://www.facebook.com/${PAGE_HANDLE}/posts/1`)).toBe(true);
    expect(isAllowedPath("https://www.facebook.com/some.other.page/posts/1")).toBe(false);
    expect(isAllowedPath("https://twitter.com/x")).toBe(false);
  });

  it("رابط خارج الصفحة يُستبعد من الاستخراج", () => {
    const { extract } = getAdapter("muain_ababneh_facebook");
    const result = extract({ html: FEED_PAGES[Object.keys(FEED_PAGES)[0]] });
    const urls = result.offers.map((o) => o.source_url);
    expect(urls.every((u) => u.includes(PAGE_HANDLE))).toBe(true);
    expect(result.stats.skipped.some((s) => s.reason === "outside_page_scope")).toBe(true);
  });

  it("الرابط المرمّز وغير المرمّز يُحسبان منشورًا واحدًا", () => {
    const a = "https://www.facebook.com/m.yn.babnh.babnh/posts/1001";
    const b = "https://www.facebook.com/m.yn.babnh.babnh/posts/1001#top";
    expect(canonicalUrl(a)).toBe(canonicalUrl(b));
    const { unique } = dedupe([{ source_url: a }, { source_url: b }]);
    expect(unique).toHaveLength(1);
  });
});

// ===============================================================
// تصنيف المصادر — لا خلط
// ===============================================================
describe("تصنيف المصادر", () => {
  const muain = SOURCE_SEED.find((s) => s.source_name.includes("معين"));
  const daleel = SOURCE_SEED.find((s) => s.source_name === "دليل عقار");

  it("معين = office", () => {
    expect(sourceConfig(muain).source_type).toBe(SOURCE_CLASS.OFFICE);
    expect(muain.classification).toBe("office_listing");
  });

  it("دليل عقار = marketing_brokerage", () => {
    expect(sourceConfig(daleel).source_type).toBe(SOURCE_CLASS.MARKETING);
  });

  it("المصدران مستقلان — لا يُلغي أحدهما الآخر", () => {
    expect(muain).toBeTruthy();
    expect(daleel).toBeTruthy();
    expect(muain.adapter).not.toBe(daleel.adapter);
    expect(listAdapters()).toHaveLength(2);
  });

  it("العرض يحمل هوية مصدره خلال الخط", async () => {
    const r = await runIngestion(
      { ...GRANTED_MUAIN_SOURCE, source_type: "office", classification: "office_listing" },
      { fetcher: createFixtureFetcher(FEED_PAGES), politeDelayMs: 0 }
    );
    const all = [...r.publish_candidates, ...r.review_required];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((o) => o.source_type === "office")).toBe(true);

    const d = await runIngestion(
      { ...DALEEL_SOURCE, source_type: "marketing_brokerage" },
      { fetcher: createFixtureFetcher(DALEEL_PAGES), politeDelayMs: 0 }
    );
    expect(d.publish_candidates.every((o) => o.source_type === "marketing_brokerage")).toBe(true);
  });
});

// ===============================================================
// بوابة الإذن
// ===============================================================
describe("بوابة الإذن لمصدر معين", () => {
  it("مصدر الإنتاج pending و disabled", () => {
    const muain = SOURCE_SEED.find((s) => s.source_name.includes("معين"));
    expect(muain.permission_status).toBe("pending");
    expect(muain.enabled).toBe(false);
    expect(evaluateSource(muain, { hasAdapter: () => true }).reason)
      .toBe(BLOCK_REASON.PERMISSION_PENDING);
  });

  it("pending: الجالب لا يُستدعى إطلاقًا", async () => {
    const spy = { fetchPage: vi.fn() };
    const r = await runIngestion(PENDING_MUAIN_SOURCE, { fetcher: spy });
    expect(spy.fetchPage).not.toHaveBeenCalled();
    expect(r.status).toBe(RUN_STATUS.SKIPPED);
  });

  it("disabled: الجالب لا يُستدعى إطلاقًا", async () => {
    const spy = { fetchPage: vi.fn() };
    await runIngestion(DISABLED_MUAIN_SOURCE, { fetcher: spy });
    expect(spy.fetchPage).not.toHaveBeenCalled();
  });
});

// ===============================================================
// الخط الكامل
// ===============================================================
describe("خط الاستيعاب لمصدر معين", () => {
  const fetcher = () => createFixtureFetcher(FEED_PAGES);

  it("ينتج مرشحين ومراجعات حسب الجودة", async () => {
    const r = await runIngestion(GRANTED_MUAIN_SOURCE, { fetcher: fetcher(), politeDelayMs: 0 });
    expect(r.status).toBe(RUN_STATUS.COMPLETED);
    expect(r.publish_candidates.length + r.review_required.length).toBeGreaterThan(0);
  });

  it("المنشور المرجعي يصل بقيمه كاملة", async () => {
    const r = await runIngestion(GRANTED_MUAIN_SOURCE, { fetcher: fetcher(), politeDelayMs: 0 });
    const o = [...r.publish_candidates, ...r.review_required]
      .find((x) => x.source_url.includes("1001"));
    expect(o).toBeTruthy();
    expect(o.size_m2).toBe(3716);
    expect(o.price_amount).toBe(18580);
    expect(o.type_category).toBe("land");
  });

  it("التغذية الفارغة لا تُسقط الخط", async () => {
    const r = await runIngestion(GRANTED_MUAIN_SOURCE, { fetcher: createFixtureFetcher(EMPTY_FEED), politeDelayMs: 0 });
    expect(r.status).toBe(RUN_STATUS.COMPLETED);
    expect(r.fetched_count).toBe(0);
  });

  it("التغذية التالفة تُرصد كتدهور ولا ترمي", async () => {
    const r = await runIngestion(GRANTED_MUAIN_SOURCE, { fetcher: createFixtureFetcher(BROKEN_FEED), politeDelayMs: 0 });
    expect(r.status).toBe(RUN_STATUS.COMPLETED);
    expect(r.degraded).toBe(true);
  });
});
