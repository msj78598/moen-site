-- 0005_soft_delete_properties.sql
--
-- الغرض: الحذف الناعم لجدول properties وحده.
--
-- لماذا properties فقط — تطبيقًا لمبدأ "لا تغيّر الهيكل إلا لضرورة":
--
--   properties      ✅ يحتاجه. deleteProperty كان حذفًا نهائيًا بلا رجعة،
--                      ولا يوجد حقل آخر يصلح للإخفاء.
--
--   team            ❌ لا يحتاجه. الجدول يملك is_visible أصلًا وهو كافٍ
--                      للإخفاء والاسترجاع. ومَن حذف ومتى يسجّلهما audit_log.
--                      لا مبرر لإضافة ثلاثة أعمدة لتكرار وظيفة قائمة.
--
--   external_offers ❌ لا يحتاجه. الأرشفة تتم عبر status='archived' وهي
--                      تعمل منذ البداية. ولا نمس هذا الجدول إطلاقًا.
--
--   contacts        ❌ صف واحد ثابت لا يُحذف أبدًا.
--   profiles        ❌ تُدار من Supabase Auth لا من التطبيق.
--
-- ✅ إضافة أعمدة فقط. صفر تعديل على أي بيان قائم. صفر حذف.
--    الأعمدة الجديدة تبدأ NULL أي أن كل الصفوف الحالية "غير محذوفة".
--
-- Sprint 1

alter table public.properties add column if not exists deleted_at      timestamptz;
alter table public.properties add column if not exists deleted_by      uuid references auth.users (id) on delete set null;
alter table public.properties add column if not exists deleted_by_name text;

comment on column public.properties.deleted_at is
  'الحذف الناعم. NULL = غير محذوف. الحذف النهائي ممنوع على مستوى الصلاحيات.';

-- فهرس القراءة العامة: المنشور غير المحذوف
create index if not exists properties_public_idx
  on public.properties (status, created_at desc)
  where deleted_at is null;
