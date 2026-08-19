-- 0002_status_normalization.sql
--
-- الغرض: توحيد قيم status فقط. لا شيء غير ذلك.
-- (فُصل الحذف الناعم إلى 0005 بناءً على مبدأ: ترحيل واحد = تغيير واحد.)
--
-- الحاجة: الكود كان يقرأ status ثم يهمله تمامًا، فكان كل صف في properties
-- منشورًا للعامة مهما كانت حالته. لا يمكن تطبيق "المنشور فقط يظهر"
-- بلا قيم معيارية.
--
-- ✅ لا يحذف أي صف. لا يحذف أي عمود. لا يمس external_offers القديمة.
-- ✅ القيمة الأصلية محفوظة في legacy_status قبل أي تعديل.
--
-- Sprint 1

-- ===============================================================
-- 1) حفظ القيمة الأصلية قبل أي تحويل — شبكة الأمان
-- ===============================================================
alter table public.properties      add column if not exists legacy_status text;
alter table public.external_offers add column if not exists legacy_status text;

update public.properties      set legacy_status = status where legacy_status is null;
update public.external_offers set legacy_status = status where legacy_status is null;

-- ===============================================================
-- 2) التطبيع
--
-- مطابق حرفيًا لـ normalizeStatus في src/lib/status.js:
--   أ) NULL أو فارغ        -> 'published'
--      الكود السابق كان row.status || 'متاح' أي أن الصف بلا حالة كان ظاهرًا.
--      تحويله إلى draft كان سيُخفي عروضًا ظاهرة — تراجع غير مقبول.
--   ب) قيمة غير معروفة     -> 'draft'
--      الإخفاء قابل للتراجع؛ النشر الخاطئ لا.
--
-- الأثر الفعلي على قاعدة بياناتك (مُحاكى قبل التنفيذ):
--   3 عروض  "متاح" -> "published"   |  سيختفي منها: 0
--   external_offers: كلها published أصلًا -> صفر تغيير
-- ===============================================================
update public.properties
   set status = case
     when status is null or btrim(status) = ''                  then 'published'
     when status in ('published','draft','archived','rejected') then status
     when status in ('متاح','متوفر','منشور')                     then 'published'
     when status in ('مباع','مؤجر','محجوز','منتهي','مؤرشف')       then 'archived'
     when status in ('مسودة','قيد المراجعة')                      then 'draft'
     when status in ('مرفوض')                                     then 'rejected'
     else 'draft'
   end;

update public.external_offers
   set status = case
     when status is null or btrim(status) = ''                  then 'published'
     when status in ('published','draft','archived','rejected') then status
     else 'draft'
   end;

-- ===============================================================
-- 3) ⚠️ الافتراضي قبل القيد — الترتيب هنا ليس تجميليًا
--
-- saveProperty في src/App.jsx لا يرسل حقل status إطلاقًا، فالصفوف الجديدة
-- تعتمد على القيمة الافتراضية للعمود (وهي 'متاح' على الأرجح).
-- إضافة قيد CHECK وحده كانت ستُفشل كل إضافة عرض جديد — تعطيل كامل
-- للوحة الإدارة. ضبط الافتراضي أولًا يجعل الترحيل آمنًا أيًا كانت القيمة.
-- ===============================================================
alter table public.properties      alter column status set default 'published';
alter table public.external_offers alter column status set default 'published';

-- ===============================================================
-- 4) فرض القيم المعيارية
-- ===============================================================
alter table public.properties      drop constraint if exists properties_status_check;
alter table public.properties      add  constraint properties_status_check
  check (status in ('published','draft','archived','rejected'));

alter table public.external_offers drop constraint if exists external_offers_status_check;
alter table public.external_offers add  constraint external_offers_status_check
  check (status in ('published','draft','archived','rejected'));

-- ===============================================================
-- 5) فهرس القراءة العامة لـ external_offers
--    (فهرس properties يأتي في 0005 بعد إضافة deleted_at)
-- ===============================================================
create index if not exists external_offers_status_checked_idx
  on public.external_offers (status, checked_at desc);
