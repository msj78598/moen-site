# الترحيلات (Migrations)

ترتيب التنفيذ إلزامي. شغّلها في **Supabase SQL Editor** واحدًا تلو الآخر.

| # | الملف | الغرض | الخطورة |
|---|---|---|---|
| 0001 | `0001_baseline_schema.sql` | توثيق المخطط الذي كان موجودًا في الكود فقط | 🟢 آمن — كله `IF NOT EXISTS` |
| 0002 | `0002_status_and_soft_delete.sql` | توحيد `status` + الحذف الناعم | 🟡 يعدّل بيانات — اقرأ التحذير أدناه |
| 0003 | `0003_leads.sql` | جدول الطلبات | 🟢 جدول جديد |
| 0004 | `0004_audit_log.sql` | سجل التدقيق + triggers | 🟢 إضافة |
| 0005 | `0005_rls_policies.sql` | سياسات RLS | 🔴 **حساس — راجعه سطرًا سطرًا** |

## قبل أي شيء

شغّل `../audit/rls_audit.sql` أولًا وأرسل النتائج. الاستعلامان **1** و **3** يكشفان
إن كان جدول `properties` مكشوفًا للكتابة من المفتاح العام.

## تحذير 0002

يعيد كتابة عمود `status`. القيمة الأصلية تُحفظ في `legacy_status` قبل التحويل،
فلا شيء يضيع. لكن:

- `NULL` / فارغ → `published` (حفاظًا على السلوك السابق تمامًا)
- قيمة عربية معروفة → ما يقابلها
- **أي قيمة أخرى → `draft`، أي تختفي من الموقع**

بعد التنفيذ شغّل استعلام **6** في ملف التدقيق لمراجعة ما اختفى، ثم أعده يدويًا
إلى `published` إن لزم.

للتراجع عن التحويل:

```sql
update public.properties set status = legacy_status where legacy_status is not null;
```

## تحذير 0005

بعد تطبيقه:

- الزائر يرى `properties` بحالة `published` وغير المحذوفة فقط.
- الزائر **لا يستطيع قراءة `leads` إطلاقًا** — الإدخال فقط.
- `DELETE` ممنوع على كل الجداول للجميع. الحذف يتم بـ `UPDATE`.
- الكتابة على `external_offers` صارت حصرًا لـ `service_role` (العامل/GitHub Actions).

إن ظهر الموقع فارغًا بعد التطبيق، فالسبب غالبًا أن `profiles` لا يحتوي صفًا
للمستخدم المسجّل — راجع استعلام **4** في ملف التدقيق.

### التراجع عن 0005

```sql
-- طوارئ فقط: يعطّل الحماية ويعيد الوضع إلى ما كان عليه
alter table public.properties      disable row level security;
alter table public.team            disable row level security;
alter table public.contacts        disable row level security;
alter table public.leads           disable row level security;
alter table public.external_offers disable row level security;
```
