/**
 * بذرة سجل المصادر.
 *
 * مطابقة لجدول public.sources في supabase/migrations/0007_sources.sql.
 * تُستخدم عندما لا يكون الجدول موجودًا بعد، حتى يعمل الاستيعاب والاختبارات
 * بلا اعتماد على قاعدة البيانات.
 *
 * ⚠️ لا يُضاف أي مصدر هنا بلا permission_status صريح.
 *    الافتراضي 'pending' ومعناه: ممنوع التشغيل.
 */

export const SOURCE_SEED = Object.freeze([
  Object.freeze({
    source_name: "دليل عقار",
    source_url:
      "https://daleelaqar.com/search/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA-%D9%84%D9%84%D8%A8%D9%8A%D8%B9/%D8%A7%D8%B1%D8%A8%D8%AF",
    source_type: "listing_site",
    adapter: "daleelaqar",

    // لم يُحسم الإذن -> ممنوع التشغيل. لا يُغيَّر إلا بقرار موثّق.
    permission_status: "pending",
    permission_note: "لم يُحسم وضع الإذن. معطّل حتى المراجعة القانونية.",
    enabled: false,

    scrape_interval_minutes: 1440,
    max_offers_per_run: 36,
    max_allowed_drop_percent: 30,

    last_checked_at: null,
    last_success_at: null,
    last_error: null,
    last_offer_count: null,
  }),
]);
