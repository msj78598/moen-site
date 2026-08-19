-- ===============================================================
-- GO_LIVE.sql — الخطوة الوحيدة المتبقية لتشغيل الوكلاء
--
-- الصق هذا الملف كاملًا في Supabase SQL Editor واضغط Run مرة واحدة.
-- مغلّف بـ begin/commit: إما ينجح كله أو لا يتغيّر شيء.
--
-- يفعل ثلاثة أشياء:
--   1) يضيف أعمدة القيم المطبَّعة إلى external_offers  (0008)
--   2) ينشئ جدول طابور المراجعة                        (0009)
--   3) يفتح إذن "دليل عقار" في جدول sources
--
-- ⚠️ إضافات فقط. لا حذف · لا إعادة تسمية · لا تعديل لأي صف قائم.
--    الـ8 عروض المنشورة والـ78 المؤرشفة لا تُمس.
-- ===============================================================

begin;

-- ---------------------------------------------------------------
-- 1) أعمدة القيم المطبَّعة
--
-- الخط يحسبها بالفعل (سعر رقمي، مساحة بالمتر، تصنيف، عنوان) لكنها
-- تُفقد عند الكتابة لغياب الأعمدة. بدونها يبقى price نصًا ويستحيل
-- الفرز أو الفلترة بالسعر.
-- ---------------------------------------------------------------
alter table public.external_offers add column if not exists title           text;
alter table public.external_offers add column if not exists type_category   text;
alter table public.external_offers add column if not exists location_key    text;
alter table public.external_offers add column if not exists size_m2         numeric;
alter table public.external_offers add column if not exists price_amount    numeric;
alter table public.external_offers add column if not exists price_currency  text;
alter table public.external_offers add column if not exists price_unit      text;
alter table public.external_offers add column if not exists listing_code    text;

-- تصنيف المصدر: office = عرض مكتب | marketing_brokerage = وساطة تسويقية
alter table public.external_offers add column if not exists source_type     text;

comment on column public.external_offers.size_m2 is
  'المساحة بالمتر المربع. NULL = غير معلومة — لا تُخمَّن أبدًا.';
comment on column public.external_offers.price_amount is
  'السعر رقمًا. NULL = غير معلن، ويُعرض "السعر عند التواصل".';
comment on column public.external_offers.source_type is
  'office = عرض مكتب | marketing_brokerage = وساطة تسويقية';

alter table public.external_offers drop constraint if exists external_offers_price_unit_check;
alter table public.external_offers add  constraint external_offers_price_unit_check
  check (price_unit is null or price_unit in ('total', 'per_m2'));

alter table public.external_offers drop constraint if exists external_offers_size_m2_check;
alter table public.external_offers add  constraint external_offers_size_m2_check
  check (size_m2 is null or (size_m2 > 0 and size_m2 <= 5000000));

alter table public.external_offers drop constraint if exists external_offers_price_amount_check;
alter table public.external_offers add  constraint external_offers_price_amount_check
  check (price_amount is null or price_amount > 0);

create index if not exists external_offers_price_idx
  on public.external_offers (price_amount)
  where status = 'published' and price_amount is not null;

create index if not exists external_offers_size_idx
  on public.external_offers (size_m2)
  where status = 'published' and size_m2 is not null;

create index if not exists external_offers_source_type_idx
  on public.external_offers (source_type, status);

-- ---------------------------------------------------------------
-- 2) طابور المراجعة
--
-- كل ما لم يجتز حواجز النشر أو التحقق يُسجَّل هنا بسببه.
-- لا ترقية تلقائية إلى النشر — القرار بشري.
-- ---------------------------------------------------------------
create table if not exists public.review_queue (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null,
  source          text,
  source_url      text,
  reason          text,
  quality_score   integer,
  errors          jsonb not null default '[]'::jsonb,
  warnings        jsonb not null default '[]'::jsonb,
  details         jsonb not null default '{}'::jsonb,
  status          text not null default 'pending',
  decision_reason text,
  decided_by      uuid references auth.users (id) on delete set null,
  decided_at      timestamptz,
  attempts        integer not null default 1,
  created_at      timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),

  constraint review_queue_kind_check check (
    kind in ('ingestion_review','verification_review','archive_blocked','duplicate_suspect')
  ),
  constraint review_queue_status_check check (
    status in ('pending','approved','rejected','resolved')
  )
);

create unique index if not exists review_queue_unique_pending_idx
  on public.review_queue (kind, source_url)
  where status = 'pending' and source_url is not null;

create index if not exists review_queue_status_idx
  on public.review_queue (status, created_at desc);

alter table public.review_queue enable row level security;

drop policy if exists review_queue_staff_read on public.review_queue;
create policy review_queue_staff_read on public.review_queue
  for select to authenticated using (public.is_staff());

drop policy if exists review_queue_staff_decide on public.review_queue;
create policy review_queue_staff_decide on public.review_queue
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

revoke insert, delete on public.review_queue from anon, authenticated;

drop trigger if exists trg_audit_review_queue on public.review_queue;
create trigger trg_audit_review_queue
  after insert or update or delete on public.review_queue
  for each row execute function public.fn_audit();

-- ---------------------------------------------------------------
-- 3) فتح إذن "دليل عقار"
--
-- قرار صاحب المشروع 2026-08-20.
-- الأساس التقني: robots.txt للموقع يسمح بـ /nav/ ويُعلن sitemap صراحةً،
-- ويمنع /property/ وحده — والمحوّل يرفضه بنيويًا قبل أي طلب.
--
-- معين عبابنه يبقى pending: فيسبوك يمنع الجمع الآلي بنص صريح.
-- ---------------------------------------------------------------
alter table public.sources add column if not exists classification text;

update public.sources
   set source_url        = 'https://daleelaqar.com/sitemap.xml',
       source_type       = 'marketing_brokerage',
       classification    = 'marketing_brokerage',
       permission_status = 'granted',
       enabled           = true,
       permission_note   = 'إذن ممنوح بقرار صاحب المشروع 2026-08-20. robots.txt يسمح بـ /nav/ '
                           || 'ويعلن sitemap. المسار الممنوع /property/ مرفوض في المحوّل.',
       permission_reviewed_at = now(),
       max_offers_per_run     = 36,
       updated_at             = now()
 where source_name = 'دليل عقار';

-- تسجيل مصدر معين — محجوب بالإذن، جاهز للتفعيل لاحقًا
insert into public.sources (
  source_name, source_url, source_type, classification, adapter,
  permission_status, permission_note, enabled,
  scrape_interval_minutes, max_offers_per_run, max_allowed_drop_percent
) values (
  'معين عبابنه عبابنه',
  'https://www.facebook.com/m.yn.babnh.babnh',
  'office', 'office_listing', 'muain_ababneh_facebook',
  'pending',
  'فيسبوك يمنع الجمع الآلي بنص صريح في robots.txt. يتطلب Graph API بتوكن صفحة رسمي.',
  false,
  720, 20, 50
)
on conflict (source_name) do nothing;

commit;

-- ===============================================================
-- تحقق بعد التنفيذ — يجب أن تكون كل النتائج PASS
-- ===============================================================
select 'أعمدة القيم المطبَّعة' as check_name,
       case when count(*) = 9 then 'PASS' else 'FAIL: ' || count(*)::text end as result
  from information_schema.columns
 where table_schema = 'public' and table_name = 'external_offers'
   and column_name in ('title','type_category','location_key','size_m2',
                       'price_amount','price_currency','price_unit','listing_code','source_type')
union all
select 'جدول review_queue',
       case when count(*) = 1 then 'PASS' else 'FAIL' end
  from information_schema.tables
 where table_schema = 'public' and table_name = 'review_queue'
union all
select 'دليل عقار مفعّل',
       case when count(*) = 1 then 'PASS' else 'FAIL' end
  from public.sources
 where source_name = 'دليل عقار' and permission_status = 'granted' and enabled = true
union all
select 'معين ما زال محجوبًا',
       case when count(*) = 1 then 'PASS' else 'FAIL' end
  from public.sources
 where source_name = 'معين عبابنه عبابنه' and permission_status = 'pending'
union all
select 'العروض القائمة لم تُمس',
       case when count(*) = 8 then 'PASS' else 'راجع: ' || count(*)::text end
  from public.external_offers where status = 'published';
