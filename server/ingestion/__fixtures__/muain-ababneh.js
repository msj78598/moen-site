/**
 * بيانات محلية — منشورات "معين عبابنه — مكتب عقاري".
 *
 * ⚠️ نصوص مصاغة على نمط منشورات المكتب لاختبار الاستخراج فقط.
 *    الغرض محاكاة *صيغ الكتابة* (لهجة، أرقام عربية، "دونم"، "الف")
 *    لا نسخ محتوى. الأرقام والأحياء والأكواد مؤلَّفة.
 *
 * الشكل يحاكي استجابة Graph API — وهو المسار الرسمي الوحيد الممكن
 * مستقبلًا. الجالب المحلي يعيد نفس البنية، فيُستبدل لاحقًا بلا تعديل
 * سطر واحد في المحوّل.
 */

export const PAGE_URL = "https://www.facebook.com/m.yn.babnh.babnh";

const permalink = (id) => `https://www.facebook.com/m.yn.babnh.babnh/posts/${id}`;

export const POSTS = {
  /** الحالة المرجعية: دونم + متر، سعر متر وسعر إجمالي، أرقام عربية. */
  landFull: {
    id: "1001",
    created_time: "2026-08-15T09:12:00+0300",
    permalink: permalink("1001"),
    text: `بسم الله وعلا بركه الله

فرصه للي بدور علا هدوء واطلاله

من اراضي المغير راحوب حوض البركه

٣دونم وا٧١٦ متر سعر المتر المربع ٥دنانير

سعر القطعه كامله ١٨الف وا٥٨٠دينار

الله يبارك لصاحب النصيب

0796181720

#اراضي #للبيع #اربد #المغير #زراعي`,
  },

  /** سعر المتر فقط — بلا إجمالي معلن. */
  landPerMeterOnly: {
    id: "1002",
    created_time: "2026-08-14T11:00:00+0300",
    permalink: permalink("1002"),
    text: `ارض للبيع في بشرى
دونم ونص
سعر المتر ١٢ دينار
للجادين 0772050566
#اربد #بشرى`,
  },

  /** بلا سعر إطلاقًا. */
  landNoPrice: {
    id: "1003",
    created_time: "2026-08-13T08:00:00+0300",
    permalink: permalink("1003"),
    text: `قطعه ارض مميزه في الصريح
المساحه 750 متر
السعر عند التواصل
#اراضي #للبيع #الصريح`,
  },

  /** بلا مساحة — يجب أن تبقى null. */
  apartmentNoSize: {
    id: "1004",
    created_time: "2026-08-12T16:30:00+0300",
    permalink: permalink("1004"),
    text: `شقه للبيع في ايدون
طابق ثاني اطلاله ممتازه
السعر ٤٥ الف دينار
0797022220
#شقق #للبيع #اربد`,
  },

  /** منشور شخصي — يجب ألا يُنشر. */
  personal: {
    id: "1005",
    created_time: "2026-08-11T20:00:00+0300",
    permalink: permalink("1005"),
    text: `الحمد لله على كل حال
كل عام وانتم بخير
ادعو لنا بالتوفيق`,
  },

  /** منشور اجتماعي فيه أرقام لكن بلا عقار. */
  socialWithNumbers: {
    id: "1006",
    created_time: "2026-08-10T18:00:00+0300",
    permalink: permalink("1006"),
    text: `مبروك للاخ ابو محمد بالسياره الجديده
2026 موديل
الله يبارك`,
  },

  /** نفس المنشور برابط مرمّز — يجب أن يُحسب مكررًا. */
  duplicateEncoded: {
    id: "1001",
    created_time: "2026-08-15T09:12:00+0300",
    permalink: "https://www.facebook.com/m.yn.babnh.babnh/posts/1001?ref=share#top",
    text: "من اراضي المغير راحوب ٣دونم وا٧١٦ متر سعر القطعه كامله ١٨الف وا٥٨٠دينار",
  },

  /** رابط خارج نطاق الصفحة — يجب رفضه. */
  outsidePage: {
    id: "9999",
    created_time: "2026-08-09T10:00:00+0300",
    permalink: "https://www.facebook.com/some.other.page/posts/9999",
    text: "ارض للبيع في اربد 500 متر السعر 40 الف دينار",
  },
};

/** تغذية بشكل استجابة Graph API. */
export function feed(posts) {
  return JSON.stringify({ data: posts });
}

export const FEED_PAGES = {
  [PAGE_URL]: feed([
    POSTS.landFull, POSTS.landPerMeterOnly, POSTS.landNoPrice,
    POSTS.apartmentNoSize, POSTS.personal, POSTS.socialWithNumbers,
    POSTS.duplicateEncoded, POSTS.outsidePage,
  ]),
};

export const EMPTY_FEED = { [PAGE_URL]: feed([]) };
export const BROKEN_FEED = { [PAGE_URL]: "<html>ليس JSON</html>" };

/** مصدر تجريبي مسموح — للاختبار فقط. الإنتاج pending دائمًا. */
export const GRANTED_MUAIN_SOURCE = Object.freeze({
  source_name: "معين عبابنه — اختبار",
  source_url: PAGE_URL,
  source_type: "agency",
  adapter: "muain_ababneh_facebook",
  permission_status: "granted",
  enabled: true,
  max_offers_per_run: 20,
  max_allowed_drop_percent: 50,
});

/** حالة الإنتاج الفعلية. */
export const PENDING_MUAIN_SOURCE = Object.freeze({
  ...GRANTED_MUAIN_SOURCE,
  source_name: "معين عبابنه — مكتب عقاري",
  permission_status: "pending",
  enabled: false,
});

export const DISABLED_MUAIN_SOURCE = Object.freeze({
  ...GRANTED_MUAIN_SOURCE,
  permission_status: "granted",
  enabled: false,
});
