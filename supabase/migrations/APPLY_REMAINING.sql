-- ===============================================================
-- Sprint 1 — ما تبقى من الترحيلات (0003 و 0004 منفَّذان بالفعل)
-- الصق الملف كاملًا في Supabase SQL Editor واضغط Run مرة واحدة.
-- الترتيب داخل الملف إلزامي: 0002 ثم 0005 ثم 0006.
-- ===============================================================

begin;

-- ############### 0002_status_normalization.sql ###############
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


-- ############### 0005_soft_delete_properties.sql ###############
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


-- ############### 0006_rls_policies.sql ###############
-- 0006_rls_policies.sql
--
-- (كان 0005 سابقًا. أُعيدت كتابته بالكامل ليطابق الـschema الفعلي.)
--
-- الغرض: المفتاح العام منشور داخل حزمة JavaScript بحكم التصميم،
-- فالحماية الحقيقية الوحيدة هي RLS.
--
-- الأعمدة المستخدمة هنا — كلها متحقَّق من وجودها:
--   properties.deleted_at   <- يضيفه 0005 (شرط: نفّذ 0005 قبل هذا الملف)
--   properties.status       <- موجود، ومعيّر بـ 0002
--   team.is_visible         <- موجود أصلًا (لا يُستخدم deleted_at لأنه غير موجود)
--   external_offers.status  <- موجود (لا يُستخدم deleted_at لأنه غير موجود)
--   leads.deleted_at        <- جزء من تعريف الجدول في 0003
--
-- ⚠️ ترتيب إلزامي: 0002 ثم 0003 ثم 0004 ثم 0005 ثم هذا الملف.
--    تنفيذه قبل 0002 يُخفي العروض الثلاثة (لأن حالتها 'متاح' لا 'published').
--    تنفيذه قبل 0005 يفشل (لأن properties.deleted_at لن يكون موجودًا).
--
-- تحقق مسبق: profiles = 5 صفوف و auth.users = 5 — فلا خطر إقفال للإدارة.
--
-- Sprint 1

-- ===============================================================
-- دوال مساعدة (SECURITY DEFINER لتتجاوز RLS على profiles)
-- ===============================================================
create or replace function public.current_profile_role()
returns text
language sql stable security definer
set search_path = public
as $fn$
  select role from public.profiles where id = auth.uid();
$fn$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $fn$
  select exists (select 1 from public.profiles where id = auth.uid());
$fn$;

create or replace function public.has_perm(perm text)
returns boolean
language sql stable security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (p.role = 'owner' or coalesce((p.permissions ->> perm)::boolean, false))
  );
$fn$;

comment on function public.has_perm(text) is
  'نفس منطق can() في الواجهة: owner يتجاوز كل شيء، وإلا يُقرأ المفتاح من permissions.';

-- ===============================================================
-- تفعيل RLS
-- ===============================================================
alter table public.profiles        enable row level security;
alter table public.properties      enable row level security;
alter table public.team            enable row level security;
alter table public.contacts        enable row level security;
alter table public.external_offers enable row level security;
alter table public.leads           enable row level security;
alter table public.audit_log       enable row level security;

-- ===============================================================
-- profiles : كل مستخدم يقرأ صفّه فقط. لا كتابة من العميل.
-- الحسابات الخمسة الموجودة لا تُمس — هذه قراءة فقط.
-- ===============================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- ===============================================================
-- properties
-- ===============================================================
drop policy if exists properties_public_read  on public.properties;
drop policy if exists properties_staff_read   on public.properties;
drop policy if exists properties_staff_insert on public.properties;
drop policy if exists properties_staff_update on public.properties;

create policy properties_public_read on public.properties
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

create policy properties_staff_read on public.properties
  for select to authenticated
  using (public.is_staff());

create policy properties_staff_insert on public.properties
  for insert to authenticated
  with check (public.has_perm('add'));

create policy properties_staff_update on public.properties
  for update to authenticated
  using (public.has_perm('edit') or public.has_perm('delete'))
  with check (public.has_perm('edit') or public.has_perm('delete'));

-- ⛔ لا سياسة DELETE — الحذف النهائي ممنوع. الحذف يتم بـ UPDATE.
revoke delete on public.properties from anon, authenticated;

-- ===============================================================
-- team
-- ⚠️ لا إشارة إلى deleted_at ولا updated_at — العمودان غير موجودين.
--    الإخفاء عبر is_visible وهو موجود أصلًا.
-- ===============================================================
drop policy if exists team_public_read  on public.team;
drop policy if exists team_staff_read   on public.team;
drop policy if exists team_staff_write  on public.team;
drop policy if exists team_staff_update on public.team;

create policy team_public_read on public.team
  for select to anon, authenticated
  using (is_visible = true);

create policy team_staff_read on public.team
  for select to authenticated
  using (public.is_staff());

create policy team_staff_write on public.team
  for insert to authenticated
  with check (public.has_perm('manage_team'));

create policy team_staff_update on public.team
  for update to authenticated
  using (public.has_perm('manage_team'))
  with check (public.has_perm('manage_team'));

revoke delete on public.team from anon, authenticated;

-- ===============================================================
-- contacts : بيانات المكتب العامة (صف واحد id=1)
-- ===============================================================
drop policy if exists contacts_public_read  on public.contacts;
drop policy if exists contacts_staff_write  on public.contacts;
drop policy if exists contacts_staff_update on public.contacts;

create policy contacts_public_read on public.contacts
  for select to anon, authenticated
  using (true);

create policy contacts_staff_write on public.contacts
  for insert to authenticated
  with check (public.has_perm('edit_contact'));

create policy contacts_staff_update on public.contacts
  for update to authenticated
  using (public.has_perm('edit_contact'))
  with check (public.has_perm('edit_contact'));

revoke delete on public.contacts from anon, authenticated;

-- ===============================================================
-- external_offers
-- ⚠️ لا إشارة إلى deleted_at — العمود غير موجود ولن يُضاف.
--    الصفوف الثمانية المنشورة تبقى ظاهرة، والمؤرشفة تبقى كما هي بلا مساس.
--    الكتابة حصرًا للعامل عبر service_role.
-- ===============================================================
drop policy if exists "Public can read published external offers" on public.external_offers;
drop policy if exists external_offers_public_read on public.external_offers;
drop policy if exists external_offers_staff_read  on public.external_offers;

create policy external_offers_public_read on public.external_offers
  for select to anon, authenticated
  using (status = 'published');

create policy external_offers_staff_read on public.external_offers
  for select to authenticated
  using (public.is_staff());

revoke insert, update, delete on public.external_offers from anon, authenticated;

-- ===============================================================
-- leads : أهم سياسة خصوصية في المشروع
--   الزائر المجهول: إدخال فقط. لا يقرأ أي طلب — ولا حتى طلبه هو.
-- ===============================================================
drop policy if exists leads_public_insert on public.leads;
drop policy if exists leads_staff_read    on public.leads;
drop policy if exists leads_staff_update  on public.leads;

create policy leads_public_insert on public.leads
  for insert to anon, authenticated
  with check (
    lead_type in ('marketing_request','service_request','property_inquiry','search_request')
    and length(btrim(name))  between 2 and 120
    and length(btrim(phone)) between 6 and 30
    and coalesce(length(request_text), 0) <= 4000
    and status = 'new'          -- الزائر لا يختار حالة الطلب
    and assigned_to is null     -- ولا يسند الطلب لأحد
    and deleted_at is null
  );

create policy leads_staff_read on public.leads
  for select to authenticated
  using (public.is_staff());

create policy leads_staff_update on public.leads
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke delete on public.leads from anon, authenticated;

-- ===============================================================
-- audit_log : قراءة للمالك فقط، ولا كتابة من العميل.
-- (fn_audit يكتب بـ SECURITY DEFINER فيتجاوز هذه السياسات)
-- ===============================================================
drop policy if exists audit_log_owner_read on public.audit_log;

create policy audit_log_owner_read on public.audit_log
  for select to authenticated
  using (public.current_profile_role() = 'owner');

revoke insert, update, delete on public.audit_log from anon, authenticated;


commit;
