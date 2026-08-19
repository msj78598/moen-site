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
    source_url:
      "https://daleelaqar.com/search/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA-%D9%84%D9%84%D8%A8%D9%8A%D8%B9/%D8%A7%D8%B1%D8%A8%D8%AF",
    source_type: "listing_site",
    adapter: "daleelaqar",

    permission_status: "pending",
    permission_note:
      "لم تُراجَع شروط الاستخدام ولا يوجد إذن موثّق. معطّل حتى المراجعة القانونية.",
    enabled: false,

    scrape_interval_minutes: 1440,
    max_offers_per_run: 36,
    max_allowed_drop_percent: 30,

    last_checked_at: null,
    last_success_at: null,
    last_error: null,
    last_offer_count: null,
  }),

  // ===============================================================
  // معين عبابنه — صفحة المكتب على فيسبوك
  //
  // ⚠️ لم يُبنَ محوّل لهذا المصدر، عن قصد.
  //
  // الصفحة على منصة تشترط شروط استخدام صريحة، والوصول الآلي لمحتواها
  // يتطلب إما Graph API بتفويض رسمي من مالك الصفحة، أو إذنًا مكتوبًا.
  // البدائل التقنية المتاحة (تسجيل دخول آلي، تجاوز الحماية، كشط
  // الواجهة العامة) كلها مخالفة لشروط المنصة، فلم تُنفَّذ.
  //
  // المصدر مسجَّل هنا ليكون جزءًا من نطاق وكيل البحث كما طُلب، لكنه
  // محجوب بسببين مستقلين: permission_status=pending، و adapter غير
  // موجود. بوابة الإذن ترفضه قبل أي اتصال.
  //
  // المسار المشروع للتفعيل: توكن Graph API من مالك الصفحة، ثم محوّل
  // يقرأ من الـAPI الرسمي لا من صفحة الويب.
  // ===============================================================
  Object.freeze({
    source_name: "معين عبابنه - صفحة المكتب",
    source_url: "https://www.facebook.com/share/1BtQWMWQgv/",
    source_type: "agency",
    adapter: "facebook_page_api", // غير مُنفَّذ — محجوز للمسار الرسمي

    permission_status: "pending",
    permission_note:
      "يتطلب Graph API بتفويض من مالك الصفحة. ممنوع الكشط المباشر لمخالفته شروط المنصة.",
    enabled: false,

    scrape_interval_minutes: 720,
    max_offers_per_run: 20,
    max_allowed_drop_percent: 40, // نشر الصفحات غير منتظم بطبعه

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
