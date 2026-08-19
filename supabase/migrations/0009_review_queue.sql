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
