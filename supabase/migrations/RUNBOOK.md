# دليل تنفيذ ترحيلات Sprint 1

> لا أستطيع تنفيذ DDL: أملك المفتاح العام فقط، وPostgREST لا ينفّذ DDL
> حتى بمفتاح service_role. التنفيذ منك في **Supabase SQL Editor**.

## الحالة الآن (متحقَّق منها بالقراءة)

| الترحيل | الحالة |
|---|---|
| `0003_leads.sql` | ✅ **منفَّذ** |
| `0004_audit_log.sql` | ✅ **منفَّذ** |
| `0002_status_normalization.sql` | ⬜ متبقٍ |
| `0005_soft_delete_properties.sql` | ⬜ متبقٍ |
| `0006_rls_policies.sql` | ⬜ متبقٍ |

`npm run verify:sprint1` -> **13/17**

## التنفيذ

الصق **`APPLY_REMAINING.sql`** كاملًا في SQL Editor واضغط Run مرة واحدة.
الملف مغلّف بـ `begin; ... commit;` فإما ينجح كله أو لا يتغيّر شيء.

الترتيب داخله إلزامي:

1. **0002** — يوحّد `status` (`متاح` -> `published`) ويضبط الافتراضي قبل القيد.
2. **0005** — يضيف `deleted_at` لـ `properties` **وحده**.
3. **0006** — سياسات RLS. يشترط 0002 و 0005 قبله.

## بعد التنفيذ

```sql
-- الصق supabase/audit/post_migration_checks.sql
```
ثم:
```bash
npm run verify:sprint1     # المتوقع 17/17
```

⚠️ **لا تنشر الموقع قبل 0006.** جدول `leads` حاليًا بلا RLS أي أنه مقروء
بالمفتاح العام. هو فارغ الآن فلا تسريب، لكن نشر الواجهة الجديدة سيبدأ
بكتابة بيانات عملاء فيه.

## التراجع

```sql
-- عن 0002
update public.properties set status = legacy_status where legacy_status is not null;
alter table public.properties alter column status set default 'متاح';
alter table public.properties drop constraint if exists properties_status_check;

-- عن 0006 (طوارئ فقط - يعطّل الحماية)
alter table public.properties      disable row level security;
alter table public.team            disable row level security;
alter table public.contacts        disable row level security;
alter table public.leads           disable row level security;
alter table public.external_offers disable row level security;
alter table public.profiles        disable row level security;
```

`0005` لا يحتاج تراجعًا: يضيف أعمدة فارغة فقط.
