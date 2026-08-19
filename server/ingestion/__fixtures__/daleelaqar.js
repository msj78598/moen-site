/**
 * بيانات محلية مصنوعة يدويًا — محوّل "دليل عقار".
 *
 * ⚠️ لا شيء هنا منسوخ من الموقع. الأحياء والأكواد والأسعار مؤلَّفة.
 *    ما يُحاكى هو *شكل* الاستجابة فقط: بنية الرابط ووسم JSON-LD.
 *
 * تعكس البنية الحقيقية بعد إعادة بناء الموقع (أغسطس 2026):
 *   الاكتشاف من sitemap · التفاصيل من RealEstateListing في صفحة الإعلان.
 */

const nav = (district, locality, hood, type, size, code) =>
  `https://daleelaqar.com/nav/محافظة-اربد/${district}/${locality}/جدول-الأحياء/${hood}/${type}/للبيع/${size}متر/${code}`;

export const SITEMAP_INDEX_URL = "https://daleelaqar.com/sitemap.xml";
export const LANDS_XML = "https://daleelaqar.com/lands.xml";
export const BASE_URL = SITEMAP_INDEX_URL;

export const URLS = {
  complete:   nav("اراضي-اربد", "اربد",   "المردمه", "أرض",  "514",  "01285"),
  noPrice:    nav("شقق-اربد",   "ايدون",  "الطوال",  "شقة",  "134",  "00412"),
  badPrice:   nav("اراضي-اربد", "بشرى",   "ابان",    "منزل", "377",  "00513"),
  perMeter:   nav("اراضي-اربد", "الصريح", "الوقف",   "أرض",  "1000", "00614"),
  duplicate:  nav("اراضي-اربد", "اربد",   "المردمه", "أرض",  "514",  "01285"),
  outOfScope: "https://daleelaqar.com/nav/محافظة-عمان/اراضي-عمان/عمان/جدول-الأحياء/تلاع/أرض/للبيع/500متر/09999",
  disallowed: "https://daleelaqar.com/property/12345",
  foreign:    "https://not-our-source.example.com/listing/999",
  unparsable: "https://daleelaqar.com/nav/hands/support",
};

const sitemapXml = (locs) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset>${
    locs.map((l) => `<url><loc>${l}</loc></url>`).join("")
  }</urlset>`;

const listingHtml = ({ name, price, currency = "JOD" }) =>
  `<!doctype html><html><head>
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList" })}</script>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "RealEstateListing", name,
    ...(price === null || price === undefined
      ? {}
      : { offers: { "@type": "Offer", price, priceCurrency: currency, availability: "https://schema.org/InStock" } }),
  })}</script>
</head><body></body></html>`;

const SITEMAPS = {
  [SITEMAP_INDEX_URL]: sitemapXml([LANDS_XML]),
  [LANDS_XML]: sitemapXml([
    URLS.complete, URLS.noPrice, URLS.badPrice, URLS.perMeter,
    URLS.duplicate, URLS.outOfScope, URLS.disallowed, URLS.foreign, URLS.unparsable,
  ]),
};

const DETAILS = {
  [URLS.complete]: listingHtml({ name: "أرض للبيع في اربد - محافظة اربد", price: 80000 }),
  [URLS.noPrice]:  listingHtml({ name: "شقة للبيع في ايدون", price: null }),
  [URLS.badPrice]: listingHtml({ name: "منزل للبيع في بشرى", price: ".." }),
  [URLS.perMeter]: listingHtml({ name: "أرض للبيع في الصريح", price: "٤ دنانير للمتر" }),
};

export const PAGES = { ...SITEMAPS, ...DETAILS };

/** JSON-LD مفقود — يعود المحوّل لبيانات الرابط بلا سعر ولا عنوان. */
export const DEGRADED_PAGES = {
  ...SITEMAPS,
  ...Object.fromEntries(
    Object.keys(DETAILS).map((u) => [u, "<!doctype html><html><body>لا بيانات منظمة</body></html>"])
  ),
};

/** sitemap فارغ — لا إعلانات إطلاقًا. */
export const EMPTY_PAGES = {
  [SITEMAP_INDEX_URL]: sitemapXml([LANDS_XML]),
  [LANDS_XML]: sitemapXml([]),
};

export const GRANTED_SOURCE = Object.freeze({
  source_name: "مصدر اختباري",
  source_url: SITEMAP_INDEX_URL,
  source_type: "listing_site",
  adapter: "daleelaqar",
  permission_status: "granted",
  enabled: true,
  max_offers_per_run: 36,
  max_allowed_drop_percent: 30,
});

export const PENDING_SOURCE = Object.freeze({
  ...GRANTED_SOURCE, source_name: "دليل عقار",
  permission_status: "pending", enabled: false,
});

export const DISABLED_SOURCE = Object.freeze({
  ...GRANTED_SOURCE, source_name: "مصدر معطّل",
  permission_status: "granted", enabled: false,
});

export const DENIED_SOURCE = Object.freeze({
  ...GRANTED_SOURCE, source_name: "مصدر مرفوض",
  permission_status: "denied", enabled: true,
});
