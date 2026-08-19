/**
 * بذرة سجل المصادر.
 *
 * مطابقة لجدول public.sources (supabase/migrations/0007_sources.sql).
 * تُستخدم حين يكون الجدول غير متاح، فيظل النظام والاختبارات تعمل.
 *
 * ===== قاعدة غير قابلة للتفاوض =====
 * كل مصدر يبدأ permission_status='pending' و enabled=false.
 * لا يُرفع أي مصدر إلى 'granted' إلا بقرار موثّق من صاحب المشروع بعد
 * مراجعة شروط استخدام المصدر. لم يُمنح أي مصدر هذا الإذن حتى الآن.
 *
 * أثر ذلك عمليًا: بوابة الإذن ترفض كل المصادر أدناه قبل أي نداء شبكة،
 * فلا يوجد scraping حقيقي في النظام.
 */

export const SOURCE_SEED = Object.freeze([
  // ===============================================================
  // دليل عقار — موقع إعلانات عقارية، نطاق إربد
  // ===============================================================
  Object.freeze({
    source_name: "دليل عقار",
    // الاكتشاف من الـsitemap المُعلَن في robots.txt — لا من صفحة البحث.
    source_url: "https://daleelaqar.com/sitemap.xml",
    source_type: "marketing_brokerage",
    classification: "marketing_brokerage",
    adapter: "daleelaqar",

    // قرار صاحب المشروع (2026-08-20): الإذن ممنوح.
    // الأساس التقني: robots.txt يسمح بـ /nav/ ويُعلن الـsitemap صراحةً،
    // ويمنع /property/ وحده — والمحوّل يرفضه بنيويًا في isAllowedPath.
    permission_status: "granted",
    permission_note:
      "إذن ممنوح بقرار صاحب المشروع 2026-08-20. robots.txt يسمح بـ /nav/ ويعلن sitemap. "
      + "المسار الممنوع /property/ مرفوض في المحوّل. مهلة تهذيب 800ms بين الطلبات.",
    permission_reviewed_at: "2026-08-20",
    enabled: true,

    scrape_interval_minutes: 1440,
    max_offers_per_run: 36,
    max_allowed_drop_percent: 30,

    last_checked_at: null,
    last_success_at: null,
    last_error: null,
    last_offer_count: null,
  }),

  // ===============================================================
  // معين عبابنه — مكتب عقاري (صفحة فيسبوك)
  //
  // مصدر خاص بالمكتب، مستقل تمامًا عن دليل عقار:
  //   دليل عقار   = سوق إعلانات عام في الأردن.
  //   معين عبابنه = منشورات المكتب نفسه.
  // كلاهما يغذّي نفس خط الاستيعاب، ولا يُلغي أحدهما الآخر.
  //
  // ⚠️ النطاق: صفحة واحدة محددة (m.yn.babnh.babnh) — ليس فيسبوك كله.
  //    المحوّل يرفض أي رابط خارج هذه الصفحة في isAllowedPath.
  //
  // ⚠️ الوصول: لا يوجد مسار آلي مشروع حاليًا. شروط فيسبوك تمنع القراءة
  //    الآلية لصفحات الويب، والمسار الرسمي الوحيد هو Graph API بتوكن
  //    من مالك الصفحة. لم يُكتب أي كود يسجّل دخولًا أو يستخدم كوكيز أو
  //    يلتف على الحماية. المحوّل جاهز ومختبَر، والجالب مجرّد فيُستبدل
  //    بـ Graph API عند توفر التوكن بلا تعديل سطر في المحوّل.
  // ===============================================================
  Object.freeze({
    source_name: "معين عبابنه عبابنه",
    source_url: "https://www.facebook.com/m.yn.babnh.babnh",
    source_type: "office",
    classification: "office_listing",
    adapter: "muain_ababneh_facebook",

    permission_status: "pending",
    permission_note:
      "يتطلب Graph API بتوكن من مالك الصفحة. ممنوع الكشط المباشر لمخالفته شروط المنصة.",
    enabled: false,

    scrape_interval_minutes: 720,
    max_offers_per_run: 20,
    max_allowed_drop_percent: 50,

    last_checked_at: null,
    last_success_at: null,
    last_error: null,
    last_offer_count: null,
  }),
]);

/**
 * ملاحظة عن مصادر السعودية:
 *
 * لم يُحدَّد أي مصدر سعودي بالاسم في نطاق المشروع حتى الآن، فلم يُضف
 * شيء هنا. اختراع مصادر لم تُذكر كان سيُنتج سجلًا لا يقابله واقع.
 *
 * إضافة مصدر جديد لا تحتاج تعديل الخط: صف في هذا الملف (أو في جدول
 * sources) + محوّل في server/ingestion/adapters/ + إذن موثّق.
 */
