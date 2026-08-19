-- ===============================================================
-- Sprint 4 — الترحيلتان المتبقيتان
-- الصق الملف كاملًا في Supabase SQL Editor واضغط Run مرة واحدة.
-- إضافات فقط: أعمدة nullable + جدول جديد. لا حذف ولا تعديل صفوف.
-- ===============================================================

begin;

-- ############### 0008_external_offers_normalized_fields.sql ###############
-- 0008_external_offers_normalized_fields.sql
--
-- الغرض: سدّ فجوة بين ما يحسبه خط الاستيعاب وما يستطيع الجدول تخزينه.
--
-- الخط يُنتج قيمًا مطبَّعة (سعر رقمي، مساحة بالمتر، تصنيف، عنوان) ثم
-- تُفقد عند الكتابة لأن الأعمدة غير موجودة. الأثر: يبقى price نصًا،
-- فيستحيل الفرز أو الفلترة بالسعر أو المساحة على الموقع.
--
-- ===== الأمان =====
-- إضافة أعمدة nullable فقط. لا حذف · لا إعادة تسمية · لا تغيير نوع
-- · لا لمس لأي صف قائم. الأعمدة الجديدة تبدأ NULL للصفوف الـ86
-- (8 منشورة + 78 مؤرشفة) وتُملأ تدريجيًا للعروض الجديدة فقط.
--
-- ===== التراجع =====
-- alter table public.external_offers drop column if exists <col>;
-- (لا يفقد شيئًا لأن الأعمدة لم تكن موجودة أصلًا)
--
-- تحقق مسبق (قراءة من الإنتاج 2026-08-20): الأعمدة الحالية هي
-- id · type · location · size · price · note · source_name · source_url
-- · checked_at · status · quality_score · created_at · updated_at · legacy_status
-- ولا وجود لأي من الأعمدة أدناه.
--
-- Sprint 4

alter table public.external_offers add column if not exists title           text;
alter table public.external_offers add column if not exists type_category   text;
alter table public.external_offers add column if not exists location_key    text;
alter table public.external_offers add column if not exists size_m2         numeric;
alter table public.external_offers add column if not exists price_amount    numeric;
alter table public.external_offers add column if not exists price_currency  text;
alter table public.external_offers add column if not exists price_unit      text;
alter table public.external_offers add column if not exists listing_code    text;

comment on column public.external_offers.size_m2 is
  'المساحة بالمتر المربع. NULL = غير معلومة — لا تُخمَّن أبدًا.';
comment on column public.external_offers.price_amount is
  'السعر رقمًا. NULL = غير معلن، ويُعرض "السعر عند التواصل".';
comment on column public.external_offers.price_unit is
  'total = سعر إجمالي | per_m2 = سعر المتر. لا يُحسب الإجمالي من سعر المتر.';

-- قيود خفيفة على القيم الجديدة فقط. NULL مسموح دائمًا فلا تتأثر
-- الصفوف القائمة التي ستبقى NULL.
alter table public.external_offers drop constraint if exists external_offers_price_unit_check;
alter table public.external_offers add  constraint external_offers_price_unit_check
  check (price_unit is null or price_unit in ('total', 'per_m2'));

alter table public.external_offers drop constraint if exists external_offers_size_m2_check;
alter table public.external_offers add  constraint external_offers_size_m2_check
  check (size_m2 is null or (size_m2 > 0 and size_m2 <= 5000000));

alter table public.external_offers drop constraint if exists external_offers_price_amount_check;
alter table public.external_offers add  constraint external_offers_price_amount_check
  check (price_amount is null or price_amount > 0);

-- فهارس للفرز والفلترة التي كانت مستحيلة قبل هذه الأعمدة.
create index if not exists external_offers_price_idx
  on public.external_offers (price_amount)
  where status = 'published' and price_amount is not null;

create index if not exists external_offers_size_idx
  on public.external_offers (size_m2)
  where status = 'published' and size_m2 is not null;

create index if not exists external_offers_category_idx
  on public.external_offers (type_category, status);


-- ############### 0009_review_queue.sql ###############
-- 0009_review_queue.sql
--
-- الغرض: ألا تضيع أي حالة غير مؤكدة.
-- كل ما لم يجتز حواجز النشر أو التحقق يُسجَّل هنا بسببه، بدل أن يُهمل
-- بصمت أو يُنشر على أمل.
--
-- ===== الأمان =====
-- جدول جديد بالكامل. لا يمس أي جدول قائم ولا أي صف.
--
-- ===== قاعدة =====
-- لا يتحول عنصر إلى منشور تلقائيًا. الترقية قرار بشري صريح، ولذلك
-- لا يوجد trigger ولا دالة تنقل من هنا إلى external_offers.
--
-- ملاحظة: النظام يعمل بدون هذا الجدول — يعود إلى مخزن في الذاكرة
-- (server/review/review-queue.js). الجدول يجعل الطابور معمّرًا فقط.
--
-- Sprint 4

create table if not exists public.review_queue (
  id              uuid primary key default gen_random_uuid(),

  kind            text not null,
    -- ingestion_review | verification_review | archive_blocked | duplicate_suspect
  source          text,
  source_url      text,

  reason          text,
  quality_score   integer,
  errors          jsonb not null default '[]'::jsonb,
  warnings        jsonb not null default '[]'::jsonb,
  details         jsonb not null default '{}'::jsonb,

  status          text not null default 'pending',
    -- pending | approved | rejected | resolved
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

comment on table public.review_queue is
  'طابور المراجعة البشرية. لا ترقية تلقائية إلى النشر.';

-- عنصر واحد لكل (نوع + رابط): إعادة الرصد تزيد attempts ولا تكرّر الصف.
create unique index if not exists review_queue_unique_pending_idx
  on public.review_queue (kind, source_url)
  where status = 'pending' and source_url is not null;

create index if not exists review_queue_status_idx
  on public.review_queue (status, created_at desc);

-- ===============================================================
-- RLS: بيانات تشغيلية داخلية. الكتابة للعامل عبر service_role فقط.
-- ===============================================================
alter table public.review_queue enable row level security;

drop policy if exists review_queue_staff_read on public.review_queue;
create policy review_queue_staff_read on public.review_queue
  for select to authenticated
  using (public.is_staff());

-- الموظف يقرر (approve/reject) — لكنه لا يُدرج ولا يحذف.
drop policy if exists review_queue_staff_decide on public.review_queue;
create policy review_queue_staff_decide on public.review_queue
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke insert, delete on public.review_queue from anon, authenticated;

drop trigger if exists trg_audit_review_queue on public.review_queue;
create trigger trg_audit_review_queue
  after insert or update or delete on public.review_queue
  for each row execute function public.fn_audit();


commit;
