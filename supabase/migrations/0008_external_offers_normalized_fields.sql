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
