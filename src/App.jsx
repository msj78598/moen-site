import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Handshake,
  Home,
  ListFilter,
  MapPin,
  PhoneCall,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "./supabaseClient";

export default function App() {
  const banner = "/panr.png";
  const legacyBannerNames = [
    "9c049017-4f6a-4029-9071-700b2fdf099a.png",
    "alsaqeen-banner.jpeg.jpeg",
  ];

  function normalizeBannerUrl(value) {
    if (!value || legacyBannerNames.some((name) => value.includes(name))) {
      return banner;
    }

    return value;
  }

  // هذه الحسابات تظهر بالأسماء للموظفين، والبريد يبقى مخفيًا لاستخدام Supabase Auth.
  const loginAccounts = [
    {
      id: "mokhtar",
      name: "المختار محمود عبابنه",
      label: "المختار",
      email: "mokhtar@diftain.local",
      roleLabel: "مالك",
    },
    {
      id: "moeen",
      name: "معين عبابنه",
      label: "معين",
      email: "moeen@diftain.local",
      roleLabel: "موظف",
    },
    {
      id: "zaid",
      name: "زيد عبابنه",
      label: "زيد",
      email: "zaid@diftain.local",
      roleLabel: "موظف",
    },
  ];

  const defaultTeam = [
    {
      id: 1,
      name: "المختار محمود عبابنه",
      title: "مدير عام",
      phone: "00962772050566",
      whatsapp: "https://wa.me/962772050566",
      email: "manager@ababneh.jo",
      photo: "/manager.png",
    },
    {
      id: 2,
      name: "معين عبابنه",
      title: "مدير علاقات عامة",
      phone: "00962796181720",
      whatsapp: "https://wa.me/962796181720",
      email: "relations@ababneh.jo",
      photo: "/moeen.png",
    },
    {
      id: 3,
      name: "زيد عبابنه",
      title: "مدير علاقات خارجية",
      phone: "00962797022220",
      whatsapp: "https://wa.me/962797022220",
      email: "external@ababneh.jo",
      photo: "/zaid.png",
    },
  ];

  // eslint-disable-next-line no-unused-vars
  const defaultProperties = [
    {
      id: 1,
      type: "أرض سكنية",
      location: "موقع مميز",
      size: "500 متر",
      price: "السعر عند الاتصال",
      note: "عرض مميز مناسب للسكن أو الاستثمار.",
      image: "🏞️",
      badge: "⭐ مميز",
      phone: "00962772050566",
      createdBy: "المالك",
    },
    {
      id: 2,
      type: "منزل للبيع",
      location: "داخل منطقة مخدومة",
      size: "300 متر",
      price: "حسب العرض",
      note: "منزل مناسب للعائلة وبموقع قريب من الخدمات.",
      image: "🏠",
      badge: "💎 فرصة",
      phone: "00962796181720",
      createdBy: "المالك",
    },
    {
      id: 3,
      type: "أرض تجارية",
      location: "شارع حيوي",
      size: "800 متر",
      price: "تواصل للاستفسار",
      note: "موقع استثماري ممتاز.",
      image: "🏢",
      badge: "🔥 تخفيض",
      phone: "00962797022220",
      createdBy: "المالك",
    },
  ];

  const defaultContact = {
    phone: "00962772050566",
    whatsapp: "https://wa.me/962772050566",
    facebook: "https://www.facebook.com/share/1BtQWMWQgv/",
    maps: "https://maps.app.goo.gl/EWoAmhkhp5GmMhfB8",
    banner_url: banner,
  };

  const adhkarMessages = [
    "أستغفر الله العظيم وأتوب إليه",
    "سبحان الله وبحمده، سبحان الله العظيم",
    "اللهم صل وسلم على نبينا محمد",
    "لا حول ولا قوة إلا بالله",
    "الحمد لله رب العالمين",
    "سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر",
  ];

  const externalMarketingOffers = [
    {
      id: "eidoun-waqf-854",
      type: "أرض للبيع",
      location: "إربد - إيدون / حوض الوقف",
      size: "854 م²",
      price: "80,000 دينار",
      sourceName: "يوريكا جو - إعمار للتطوير والاستثمار",
      sourceUrl:
        "https://eurekajo.com/Realestates/Details/c10395e2-d6ab-4ba1-bc61-809cd5eae782",
      checkedAt: "2026-05-25",
      note: "أرض مستوية في منطقة فلل، الخدمات واصلة حسب المصدر.",
    },
    {
      id: "eidoun-commercial-1144",
      type: "أرض تجارية",
      location: "إربد - طريق إربد الحصن / إيدون",
      size: "1144 م²",
      price: "400,000 دينار",
      sourceName: "يوريكا جو - مجموعة غلوبال العقارية",
      sourceUrl:
        "https://eurekajo.com/Realestates/Details/7a78e875-3eaf-4a26-8fa1-30891f4f3b22",
      checkedAt: "2026-05-25",
      note: "قطعة تجارية على شارع رئيسي بعرض 40م حسب المصدر.",
    },
    {
      id: "eidoun-masiya-850",
      type: "أرض للبيع",
      location: "إربد - إيدون / الماصية الشرقية",
      size: "850 م²",
      price: "170,000 دينار",
      sourceName: "يوريكا جو - إعمار للتطوير والاستثمار",
      sourceUrl:
        "https://eurekajo.com/Realestates/Details/b99de2c8-b659-4414-8f71-112ce2294c0c",
      checkedAt: "2026-05-25",
      note: "على شارع المورد الرئيسي وقريبة من دوار السفير حسب المصدر.",
    },
    {
      id: "eidoun-qarn-506",
      type: "أرض للبيع",
      location: "إربد - إيدون / قرن الجاموس",
      size: "506 م²",
      price: "60,000 دينار",
      sourceName: "يوريكا جو - إعمار للتطوير والاستثمار",
      sourceUrl:
        "https://eurekajo.com/Realestates/Details/602c0f2b-d09a-4126-bb9d-792e3b7db65c",
      checkedAt: "2026-05-25",
      note: "مناسبة لبناء فيلا ضمن منطقة فلل حسب المصدر.",
    },
    {
      id: "sareej-630",
      type: "أرض سكنية",
      location: "إربد - السريج",
      size: "630 م²",
      price: "75,600 دينار",
      sourceName: "يوريكا جو - وسيط درويش للعقار",
      sourceUrl:
        "https://eurekajo.com/Realestates/Details/5f9b3400-3fe1-450e-aba5-363c7d1c25d8",
      checkedAt: "2026-05-25",
      note: "أرض سكنية/صخرية مطلة والخدمات واصلة حسب المصدر.",
    },
    {
      id: "bushra-854",
      type: "أرض للبيع",
      location: "إربد - بشرى / قرب دوار الطيارة",
      size: "854 م²",
      price: "100,000 دينار",
      sourceName: "دليل عقار",
      sourceUrl:
        "https://daleelaqar.com/search/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA-%D9%84%D9%84%D8%A8%D9%8A%D8%B9/%D8%A7%D8%B1%D8%A8%D8%AF",
      checkedAt: "2026-05-25",
      note: "قوشان مستقل في منطقة بشرى حسب قائمة المصدر.",
    },
  ];

  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [externalOffers, setExternalOffers] = useState(externalMarketingOffers);
  const [team, setTeam] = useState(defaultTeam);
  const [contactData, setContactData] = useState(defaultContact);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 1200 : window.innerWidth
  );
  const [dhikrIndex, setDhikrIndex] = useState(0);
  const [activeTickerIndex, setActiveTickerIndex] = useState(0);
  const [offerFilter, setOfferFilter] = useState("all");

  const [showAdminDash, setShowAdminDash] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [activeTab, setActiveTab] = useState("properties");

  const [editingProperty, setEditingProperty] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [form, setForm] = useState({
    type: "",
    location: "",
    size: "",
    price: "",
    note: "",
    badge: "عادي",
    phone: "",
    image: "🏡",
    sourceType: "office",
    sourceName: "",
    sourceUrl: "",
    sourceCheckedAt: "",
    sourceConsent: false,
    imageFile: null,
  });

  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    title: "",
    phone: "",
    email: "",
    whatsapp: "",
    photo: "",
    photoFile: null,
  });

  const [marketingRequest, setMarketingRequest] = useState({
    ownerName: "",
    phone: "",
    propertyType: "",
    location: "",
    area: "",
    price: "",
    exclusive: "غير محدد",
    details: "",
    attachment: null,
  });
  const [showMarketingForm, setShowMarketingForm] = useState(false);

  function errorText(error, fallback) {
    return error?.message || error?.error_description || fallback;
  }

  async function withTimeout(label, promise, ms = 12000) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error(`انتهت مهلة ${label}. تحقق من اتصال Supabase أو الصلاحيات.`)),
        ms
      );
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  useEffect(() => {
    initApp();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
        setShowAdminDash(false);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setDhikrIndex((current) => (current + 1) % adhkarMessages.length);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, [adhkarMessages.length]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveTickerIndex((current) => current + 1);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, []);

  async function initApp() {
    setLoading(true);
    setErrorMessage("");

    try {
      await withTimeout(
        "تحميل البيانات",
        Promise.all([loadContacts(), loadTeam(), loadProperties(), loadExternalOffers()])
      );

      const { data } = await withTimeout("فحص جلسة الدخول", supabase.auth.getSession());
      if (data?.session?.user) {
        await withTimeout("تحميل صلاحيات المستخدم", loadUserProfile(data.session.user));
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(errorText(error, "تعذر تحميل البيانات من قاعدة البيانات. تأكد من إعدادات Supabase."));
    } finally {
      setLoading(false);
    }
  }

  function mapProperty(row) {
    return {
      id: row.id,
      type: row.type || "",
      location: row.location || "",
      size: row.size || "",
      price: row.price || "",
      note: row.note || "",
      badge: row.badge || "عادي",
      phone: row.phone || contactData.phone,
      image: row.image_url || "🏡",
      status: row.status || "متاح",
      sourceType: row.source_type || "office",
      sourceName: row.source_name || "",
      sourceUrl: row.source_url || "",
      sourceCheckedAt: row.source_checked_at || "",
      sourceConsent: Boolean(row.source_consent),
      createdBy: row.created_by_name || "الإدارة",
      updatedBy: row.updated_by_name || "",
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function mapTeam(row) {
    return {
      id: row.id,
      name: row.name || "",
      title: row.title || "",
      phone: row.phone || "",
      whatsapp: row.whatsapp || "",
      email: row.email || "",
      photo: row.photo_url || "",
      sort_order: row.sort_order || 0,
      is_visible: row.is_visible,
    };
  }

  async function loadContacts() {
    const { data, error } = await withTimeout(
      "قراءة بيانات التواصل",
      supabase.from("contacts").select("*").eq("id", 1).maybeSingle()
    );

    if (error) throw error;

    if (data) {
      setContactData({
        phone: data.phone || defaultContact.phone,
        whatsapp: data.whatsapp || defaultContact.whatsapp,
        facebook: data.facebook || defaultContact.facebook,
        maps: data.maps || defaultContact.maps,
        banner_url: normalizeBannerUrl(data.banner_url || defaultContact.banner_url),
      });
    }
  }

  async function loadTeam() {
    const { data, error } = await withTimeout(
      "قراءة فريق العمل",
      supabase
        .from("team")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    );

    if (error) throw error;

    if (data && data.length) {
      setTeam(data.map(mapTeam));
    }
  }

  async function loadProperties() {
    const { data, error } = await withTimeout(
      "قراءة العروض",
      supabase.from("properties").select("*").order("created_at", { ascending: false })
    );

    if (error) throw error;

    if (data && data.length) {
      setProperties(data.map(mapProperty));
    } else {
      setProperties([]);
    }
  }

  async function loadUserProfile(authUser) {
    const { data, error } = await withTimeout(
      "قراءة صلاحيات المستخدم",
      supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle()
    );

    if (error) {
      console.error(error);
      setErrorMessage("تم تسجيل الدخول لكن لم يتم العثور على صلاحيات المستخدم.");
      return;
    }

    if (!data) {
      setErrorMessage("هذا الحساب غير مضاف في جدول الصلاحيات profiles.");
      return;
    }

    setUser({
      id: authUser.id,
      email: authUser.email,
      name: data.full_name || authUser.email,
      role: data.role || "employee",
      permissions: data.permissions || {},
    });
  }

  function can(permission) {
    if (!user) return false;
    if (user.role === "owner") return true;
    return Boolean(user.permissions?.[permission]);
  }

  async function login(account) {
    const password = prompt(`أدخل كلمة مرور ${account.label}:`);

    if (!password) return;

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await withTimeout(
      "تسجيل الدخول",
      supabase.auth.signInWithPassword({
        email: account.email,
        password,
      })
    );

    setLoading(false);

    if (error) {
      alert("بيانات الدخول غير صحيحة أو الحساب غير موجود");
      console.error(error);
      setErrorMessage(errorText(error, "تعذر تسجيل الدخول."));
      return;
    }

    if (data?.user) {
      await loadUserProfile(data.user);
      setShowAdminDash(true);
      alert(`تم الدخول باسم ${account.name}`);
    }
  }

  function adminLoginClick(e) {
    e.preventDefault();

    if (user) {
      setShowAdminDash(!showAdminDash);
      return;
    }

    setShowLoginPanel(!showLoginPanel);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setShowAdminDash(false);
    setEditingProperty(null);
    setEditingEmployee(null);
  }

  function resetPropertyForm() {
    setForm({
      type: "",
      location: "",
      size: "",
      price: "",
      note: "",
      badge: "عادي",
      phone: "",
      image: "🏡",
      sourceType: "office",
      sourceName: "",
      sourceUrl: "",
      sourceCheckedAt: "",
      sourceConsent: false,
      imageFile: null,
    });
    setEditingProperty(null);
  }

  async function uploadFile(bucket, file) {
    if (!file) return null;

    const safeName = file.name.replace(/\s+/g, "-").replace(/[^\w.-]/g, "");
    const filePath = `${Date.now()}-${safeName}`;

    const { error } = await withTimeout(
      `رفع الملف إلى ${bucket}`,
      supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })
    );

    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function saveProperty(e) {
    e.preventDefault();

    if (!can("add") && !can("edit")) {
      alert("ليس لديك صلاحية لإدارة العروض");
      return;
    }

    if (!form.type || !form.location || !form.size || !form.price) {
      alert("يرجى تعبئة نوع العقار والموقع والمساحة والسعر");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      let imageUrl = form.image;

      if (form.imageFile) {
        if (!can("upload")) {
          alert("ليس لديك صلاحية رفع الصور");
          return;
        }
        imageUrl = await uploadFile("property-images", form.imageFile);
      }

      const payload = {
        type: form.type,
        location: form.location,
        size: form.size,
        price: form.price,
        note: form.note,
        badge: form.badge || "عادي",
        phone: form.phone || contactData.phone,
        image_url: imageUrl,
        source_type: form.sourceType,
        source_name: form.sourceName,
        source_url: form.sourceUrl,
        source_checked_at: form.sourceCheckedAt || null,
        source_consent: form.sourceConsent,
        updated_by: user?.id || null,
        updated_by_name: user?.name || user?.email || "الإدارة",
        updated_at: new Date().toISOString(),
      };

      if (editingProperty) {
        if (!can("edit")) {
          alert("ليس لديك صلاحية تعديل العروض");
          return;
        }

        const { data, error } = await withTimeout(
          "تعديل العرض",
          supabase
            .from("properties")
            .update(payload)
            .eq("id", editingProperty.id)
            .select("id")
            .maybeSingle()
        );

        if (error) throw error;
        if (!data) throw new Error("لم يتم العثور على هذا العرض في قاعدة البيانات. ألغ التعديل وأضف العرض من جديد.");
      } else {
        if (!can("add")) {
          alert("ليس لديك صلاحية إضافة العروض");
          return;
        }

        const { data, error } = await withTimeout(
          "إضافة العرض",
          supabase.from("properties").insert({
            ...payload,
            created_by: user?.id || null,
            created_by_name: user?.name || user?.email || "الإدارة",
          }).select("id").single()
        );

        if (error) throw error;
        if (!data) throw new Error("لم ترجع قاعدة البيانات رقم العرض الجديد.");
      }

      await loadProperties();
      resetPropertyForm();
      alert(editingProperty ? "تم تعديل العرض" : "تمت إضافة العرض وسيظهر للجميع");
    } catch (error) {
      console.error(error);
      setErrorMessage(errorText(error, "تعذر حفظ العرض. تحقق من الصلاحيات أو إعدادات Storage."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteProperty(id) {
    if (!can("delete")) {
      alert("ليس لديك صلاحية حذف العروض");
      return;
    }

    if (!window.confirm("هل تريد حذف هذا العرض؟")) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        "حذف العرض",
        supabase.from("properties").delete().eq("id", id)
      );
      if (error) throw error;

      await loadProperties();
      alert("تم حذف العرض");
    } catch (error) {
      console.error(error);
      setErrorMessage(errorText(error, "تعذر حذف العرض."));
    } finally {
      setLoading(false);
    }
  }

  function editProperty(prop) {
    if (!can("edit")) {
      alert("ليس لديك صلاحية تعديل العروض");
      return;
    }

    setEditingProperty(prop);
    setForm({
      type: prop.type || "",
      location: prop.location || "",
      size: prop.size || "",
      price: prop.price || "",
      note: prop.note || "",
      badge: prop.badge || "عادي",
      phone: prop.phone || "",
      image: prop.image || "🏡",
      sourceType: prop.sourceType || "office",
      sourceName: prop.sourceName || "",
      sourceUrl: prop.sourceUrl || "",
      sourceCheckedAt: prop.sourceCheckedAt || "",
      sourceConsent: Boolean(prop.sourceConsent),
      imageFile: null,
    });
    setActiveTab("properties");
    setShowAdminDash(true);
    window.location.hash = "#admin";
  }

  function sourceTypeLabel(type) {
    if (type === "published") return "عرض تسويقي منشور";
    if (type === "marketing") return "وساطة تسويقية";
    return "عرض خاص بالمكتب";
  }

  function isMarketingSource(type) {
    return type === "published" || type === "marketing";
  }

  async function saveEmployee(e) {
    e.preventDefault();

    if (!can("manage_team")) {
      alert("ليس لديك صلاحية إدارة الموظفين");
      return;
    }

    if (!employeeForm.name || !employeeForm.title || !employeeForm.phone) {
      alert("يرجى تعبئة اسم الموظف والمسمى ورقم الهاتف");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      let photoUrl = employeeForm.photo;

      if (employeeForm.photoFile) {
        photoUrl = await uploadFile("team-images", employeeForm.photoFile);
      }

      const payload = {
        name: employeeForm.name,
        title: employeeForm.title,
        phone: employeeForm.phone,
        email: employeeForm.email,
        whatsapp: employeeForm.whatsapp,
        photo_url: photoUrl,
        is_visible: true,
      };

      if (editingEmployee) {
        const { data, error } = await withTimeout(
          "تعديل بيانات الموظف",
          supabase
            .from("team")
            .update(payload)
            .eq("id", editingEmployee.id)
            .select("id")
            .maybeSingle()
        );

        if (error) throw error;
        if (!data) throw new Error("لم يتم العثور على هذا الموظف في قاعدة البيانات. ألغ التعديل وأضفه من جديد.");
      } else {
        const { data, error } = await withTimeout(
          "إضافة الموظف",
          supabase.from("team").insert(payload).select("id").single()
        );
        if (error) throw error;
        if (!data) throw new Error("لم ترجع قاعدة البيانات رقم الموظف الجديد.");
      }

      await loadTeam();
      setEditingEmployee(null);
      setEmployeeForm({
        name: "",
        title: "",
        phone: "",
        email: "",
        whatsapp: "",
        photo: "",
        photoFile: null,
      });
      alert(editingEmployee ? "تم تعديل بيانات الموظف" : "تمت إضافة الموظف");
    } catch (error) {
      console.error(error);
      setErrorMessage(errorText(error, "تعذر حفظ بيانات الموظف."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteEmployee(id) {
    if (!can("manage_team")) {
      alert("ليس لديك صلاحية حذف الموظفين");
      return;
    }

    if (!window.confirm("هل تريد حذف هذا الموظف؟")) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        "حذف الموظف",
        supabase.from("team").delete().eq("id", id)
      );
      if (error) throw error;
      await loadTeam();
      alert("تم حذف الموظف");
    } catch (error) {
      console.error(error);
      setErrorMessage(errorText(error, "تعذر حذف الموظف."));
    } finally {
      setLoading(false);
    }
  }

  function handlePropertyImageUpload(e) {
    if (!can("upload")) {
      alert("ليس لديك صلاحية رفع الصور");
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    setForm({
      ...form,
      image: URL.createObjectURL(file),
      imageFile: file,
    });
  }

  function handleEmployeePhotoUpload(e) {
    if (!can("manage_team")) {
      alert("ليس لديك صلاحية إدارة الموظفين");
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    setEmployeeForm({
      ...employeeForm,
      photo: URL.createObjectURL(file),
      photoFile: file,
    });
  }

  async function saveContact(nextContact) {
    if (!can("edit_contact")) {
      alert("ليس لديك صلاحية تعديل بيانات التواصل");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const payload = {
        id: 1,
        phone: nextContact.phone,
        whatsapp: nextContact.whatsapp,
        facebook: nextContact.facebook,
        maps: nextContact.maps,
        banner_url: nextContact.banner_url || banner,
        updated_at: new Date().toISOString(),
      };

      const { error } = await withTimeout(
        "حفظ بيانات التواصل",
        supabase.from("contacts").upsert(payload, { onConflict: "id" })
      );

      if (error) throw error;

      setContactData(nextContact);
      alert("تم حفظ بيانات التواصل وستظهر للجميع");
    } catch (error) {
      console.error(error);
      setErrorMessage(errorText(error, "تعذر حفظ بيانات التواصل."));
    } finally {
      setLoading(false);
    }
  }

  function normalPhone(phone) {
    return (phone || "")
      .replace(/^00962/, "962")
      .replace(/^0/, "962")
      .replace(/\D/g, "");
  }

  function mapExternalOffer(row) {
    return {
      id: row.id,
      type: row.type || "",
      location: row.location || "",
      size: row.size || "",
      price: row.price || "السعر عند التواصل",
      sourceName: row.source_name || "مصدر معلن",
      sourceUrl: row.source_url || "#",
      checkedAt: row.checked_at || "",
      note: row.note || "",
    };
  }

  async function loadExternalOffers() {
    try {
      const { data, error } = await withTimeout(
        "قراءة العروض التسويقية الخارجية",
        supabase
          .from("external_offers")
          .select("*")
          .eq("status", "published")
          .order("checked_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(24)
      );

      if (error) {
        console.warn("External offers table is not ready yet", error);
        return;
      }

      if (data?.length) {
        setExternalOffers(data.map(mapExternalOffer));
      }
    } catch (error) {
      console.warn("Using built-in external offers fallback", error);
    }
  }

  function updateMarketingRequest(field, value) {
    setMarketingRequest((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function propertyWhatsAppUrl(property) {
    const phone = normalPhone(property.phone || contactData.phone);
    const message = `استفسار بخصوص عرض عقاري من مكتب نور الضفتين العقاري

نوع العقار: ${property.type}
الموقع: ${property.location}
المساحة: ${property.size}
السعر: ${property.price}
${property.badge && property.badge !== "عادي" ? `التصنيف: ${property.badge}` : ""}
${property.note ? `ملاحظات: ${property.note}` : ""}

أرغب بمعرفة المزيد عن هذا العرض.`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  async function submitMarketingRequest(e) {
    e.preventDefault();

    if (
      !marketingRequest.ownerName ||
      !marketingRequest.phone ||
      !marketingRequest.propertyType ||
      !marketingRequest.location
    ) {
      alert("يرجى تعبئة الاسم ورقم التواصل ونوع العقار والموقع");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    let attachmentLine = "المرفق: لم يتم إرفاق ملف";

    try {
      if (marketingRequest.attachment) {
        try {
          const attachmentUrl = await uploadFile(
            "marketing-requests",
            marketingRequest.attachment
          );
          attachmentLine = `رابط المرفق: ${attachmentUrl}`;
        } catch (uploadError) {
          console.warn("Could not upload marketing request attachment", uploadError);
          attachmentLine = `المرفق المختار: ${marketingRequest.attachment.name} - يرجى إرساله يدويًا في نفس محادثة الواتساب`;
        }
      }

      const officePhone = normalPhone(contactData.phone || contactData.whatsapp);
      const message = `طلب تسويق عقار جديد - مكتب نور الضفتين العقاري

اسم صاحب الطلب: ${marketingRequest.ownerName}
رقم التواصل: ${marketingRequest.phone}
نوع العقار: ${marketingRequest.propertyType}
الموقع / الحوض: ${marketingRequest.location}
المساحة: ${marketingRequest.area || "غير محددة"}
السعر المطلوب: ${marketingRequest.price || "غير محدد"}
هل العرض حصري؟ ${marketingRequest.exclusive}
التفاصيل:
${marketingRequest.details || "لا توجد تفاصيل إضافية"}

${attachmentLine}

أرغب بالتواصل مع المكتب لمراجعة الطلب وتجهيز التسويق العقاري.`;

      window.open(
        `https://wa.me/${officePhone}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );

      setMarketingRequest({
        ownerName: "",
        phone: "",
        propertyType: "",
        location: "",
        area: "",
        price: "",
        exclusive: "غير محدد",
        details: "",
        attachment: null,
      });
      setShowMarketingForm(false);
    } catch (error) {
      console.error(error);
      setErrorMessage(errorText(error, "تعذر تجهيز طلب التسويق العقاري."));
    } finally {
      setLoading(false);
    }
  }

  function shareProperty(property) {
    const phone = normalPhone(property.phone || contactData.phone);

    const text = `🏠 عرض عقاري من مكتب نور الضفتين العقاري

نوع العقار: ${property.type}
📍 الموقع: ${property.location}
📐 المساحة: ${property.size}
💰 السعر: ${property.price}
${property.badge && property.badge !== "عادي" ? `🏷️ ${property.badge}` : ""}
${property.note ? `✨ ملاحظات: ${property.note}` : ""}

للتواصل عبر واتساب:
https://wa.me/${phone}`;

    if (navigator.share) {
      navigator.share({
        title: property.type,
        text,
        url: window.location.href,
      });
    } else {
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(shareUrl, "_blank");
    }
  }

  function copyPropertyLink(property) {
    const text = `عرض عقاري من مكتب نور الضفتين العقاري
نوع العقار: ${property.type}
الموقع: ${property.location}
المساحة: ${property.size}
السعر: ${property.price}
${property.note || ""}`;

    navigator.clipboard.writeText(text);
    alert("تم نسخ تفاصيل العرض");
  }

  async function shareOfficeCard() {
    const siteUrl =
      typeof window !== "undefined" ? `${window.location.origin}/#promo` : "";
    const bannerUrl =
      typeof window !== "undefined"
        ? new URL(displayedBanner, window.location.origin).href
        : displayedBanner;
    const teamLines = team
      .map((person) => `${person.title} - ${person.name}: ${person.phone}`)
      .join("\n");
    const text = `بطاقة مكتب نور الضفتين العقاري الإلكترونية

بيع وشراء الأراضي والعقارات وتسويق العروض العقارية.

الهاتف: ${contactData.phone}
واتساب: ${contactData.whatsapp}
فيسبوك: ${contactData.facebook}
الموقع على الخريطة: ${contactData.maps}

فريق المكتب:
${teamLines}

رابط البطاقة:
${siteUrl}`;

    if (navigator.share) {
      try {
        const bannerFile = await getShareableBannerFile(bannerUrl);
        if (bannerFile && navigator.canShare?.({ files: [bannerFile] })) {
          await navigator.share({
            title: "بطاقة مكتب نور الضفتين العقاري",
            text,
            url: siteUrl,
            files: [bannerFile],
          });
          return;
        }

        await navigator.share({
          title: "بطاقة مكتب نور الضفتين العقاري",
          text,
          url: siteUrl,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  async function getShareableBannerFile(bannerUrl) {
    try {
      const response = await fetch(bannerUrl);
      if (!response.ok) return null;

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) return null;

      const extension = blob.type.split("/")[1] || "png";
      return new File([blob], `diftain-office-card.${extension}`, {
        type: blob.type,
      });
    } catch (error) {
      console.warn("Could not attach office card banner to share", error);
      return null;
    }
  }

  function offerCategory(offer) {
    const text = `${offer.type || ""} ${offer.location || ""}`.toLowerCase();
    if (
      text.includes("أرض") ||
      text.includes("أراضي") ||
      text.includes("ارض") ||
      text.includes("اراضي")
    ) {
      return "land";
    }
    if (text.includes("شقة") || text.includes("شقه")) return "apartment";
    if (
      text.includes("منزل") ||
      text.includes("فيلا") ||
      text.includes("مبنى") ||
      text.includes("بناية")
    ) {
      return "building";
    }
    return "other";
  }

  function filteredByCategory(items, filter) {
    if (filter === "all") return items;
    return items.filter((item) => offerCategory(item) === filter);
  }

  function latestCheckedDate(items) {
    const latest = items.map((item) => item.checkedAt).filter(Boolean).sort().at(-1);
    return latest || "يوميا";
  }

  function goToOffer(anchor) {
    setOfferFilter("all");
    window.setTimeout(() => {
      const target = document.querySelector(anchor);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.location.hash = anchor;
      }
    }, 0);
  }

  const offerFilters = [
    { id: "all", label: "الكل", Icon: ListFilter },
    { id: "land", label: "أراضي", Icon: MapPin },
    { id: "apartment", label: "شقق", Icon: Home },
    { id: "building", label: "مبان ومنازل", Icon: Building2 },
  ];
  const filteredProperties = filteredByCategory(properties, offerFilter);
  const filteredExternalOffers = filteredByCategory(externalOffers, offerFilter);
  const officeTickerOffers = properties.map((offer) => ({
    ...offer,
    anchor: `#office-offer-${offer.id}`,
    sourceLabel: isMarketingSource(offer.sourceType)
      ? sourceTypeLabel(offer.sourceType)
      : "عرض مكتب",
  }));
  const externalTickerOffers = externalOffers.map((offer) => ({
    ...offer,
    anchor: `#external-offer-${offer.id}`,
    sourceLabel: "عرض تسويقي",
  }));
  const liveOffers = [...officeTickerOffers, ...externalTickerOffers].filter(
    (offer) => offer.type && offer.location
  );
  const fallbackTickerOffers = externalMarketingOffers.map((offer) => ({
    ...offer,
    anchor: "#external-offers",
    sourceLabel: "عرض تسويقي",
  }));
  const liveTickerOffers = liveOffers.length ? liveOffers : fallbackTickerOffers;
  const activeTickerOffer =
    liveTickerOffers[activeTickerIndex % Math.max(liveTickerOffers.length, 1)] ||
    fallbackTickerOffers[0];
  const trustMetrics = [
    {
      value: `${properties.length + externalOffers.length}+`,
      label: "عرض متابع",
      Icon: BadgeCheck,
    },
    {
      value: latestCheckedDate(externalOffers),
      label: "آخر تحديث للعروض الخارجية",
      Icon: RefreshCw,
    },
    {
      value: "إربد ومناطقها",
      label: "نطاق التغطية",
      Icon: MapPin,
    },
    {
      value: "فريق مباشر",
      label: "تواصل سريع مع المكتب",
      Icon: PhoneCall,
    },
  ];
  const assuranceItems = [
    {
      title: "تحقق قبل التواصل",
      text: "نراجع توفر العرض وتفاصيله قبل أي متابعة مباشرة مع العميل.",
      Icon: SearchCheck,
    },
    {
      title: "وساطة واضحة",
      text: "نوضح مصدر العرض ونفصل بين عروض المكتب والعروض التسويقية الخارجية.",
      Icon: ShieldCheck,
    },
    {
      title: "تسويق منظم",
      text: "نرتب بيانات العقار بطريقة تسهل القرار والاستفسار والمشاركة.",
      Icon: BadgeCheck,
    },
    {
      title: "متابعة بشرية",
      text: "فريق المكتب يتابع الطلبات والاستفسارات بدل ترك العميل بين الروابط.",
      Icon: Handshake,
    },
  ];

  const qrLink =
    typeof window !== "undefined" ? window.location.origin + "/#promo" : "";

  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=270x270&data=${encodeURIComponent(
    qrLink
  )}`;

  const displayedBanner = normalizeBannerUrl(contactData.banner_url);
  const viewStyles = createResponsiveStyles(styles, viewportWidth);
  return (
    <main dir="rtl" style={viewStyles.page}>
      {errorMessage && (
        <div style={viewStyles.errorBanner}>{errorMessage}</div>
      )}
      {loading && (
        <div style={viewStyles.loadingBanner}>جاري تحميل البيانات من قاعدة البيانات...</div>
      )}
      {user && (
        <div style={viewStyles.userBanner}>
          <span>
            ✅ مرحبًا {user.name} - دخول{" "}
            {user.role === "owner" ? "مالك" : "موظف"}
          </span>
          <button style={viewStyles.logoutQuickBtn} onClick={logout}>
            خروج
          </button>
        </div>
      )}

      <header id="home" style={viewStyles.hero}>
        <nav style={viewStyles.nav}>
          <a href="#home" style={viewStyles.logoBox}>
            <span style={viewStyles.logoIcon}>🏛️</span>
            <span>
              <strong style={viewStyles.logo}>مكتب نور الضفتين العقاري</strong>
              <small style={viewStyles.subtitle}>بيع وشراء الأراضي والعقارات</small>
            </span>
          </a>

          <div style={viewStyles.navLinks}>
            <a style={viewStyles.navLink} href="#home">
              الرئيسية
            </a>
            <a style={viewStyles.navLink} href="#services">
              الخدمات
            </a>
            <a style={viewStyles.navLink} href="#marketing-request">
              سوّق عقارك
            </a>
            <a style={viewStyles.navLink} href="#properties">
              العروض
            </a>
            <a style={viewStyles.navLink} href="#external-offers">
              عروض خارجية
            </a>
            <a style={viewStyles.navLink} href="#team">
              فريق العمل
            </a>
            <a style={viewStyles.navLink} href="#promo">
              الباركود
            </a>
            <a style={viewStyles.navLink} href="#contact">
              تواصل معنا
            </a>
            <button
              style={viewStyles.adminSecretBtn}
              onClick={adminLoginClick}
              title="دخول الإدارة"
            >
              ⚙️
            </button>
          </div>
        </nav>
        {showLoginPanel && !user && (
  <div style={viewStyles.loginPanel}>
    <div style={viewStyles.loginPanelHeader}>
      <strong>دخول الإدارة</strong>
      <button
        style={viewStyles.loginPanelClose}
        onClick={() => setShowLoginPanel(false)}
      >
        ✕
      </button>
    </div>

    <p style={viewStyles.loginPanelText}>
      اختر اسم المستخدم ثم أدخل كلمة المرور الخاصة به.
    </p>

    <div style={viewStyles.loginPanelButtons}>
      {loginAccounts.map((account) => (
        <button
          key={account.id}
          style={
            account.roleLabel === "مالك"
              ? viewStyles.ownerLoginChoice
              : viewStyles.employeeLoginChoice
          }
          onClick={() => {
            setShowLoginPanel(false);
            login(account);
          }}
        >
          {account.roleLabel === "مالك" ? "👑" : "👤"} {account.label}
        </button>
      ))}
    </div>
  </div>
)}

        <div style={viewStyles.dhikrBar} aria-live="polite">
          <span style={viewStyles.dhikrText}>
            {adhkarMessages[dhikrIndex]}
          </span>
        </div>

        <div style={viewStyles.bannerBox}>
          <img src={displayedBanner} alt="مكتب نور الضفتين العقاري" style={viewStyles.banner} />
        </div>

        <div style={viewStyles.heroContent}>
          <span style={viewStyles.badge}>
            مؤسسة تسويق عقاري بخدمة مباشرة وفريق متخصص
          </span>

          <h1 style={viewStyles.title}>
            نسوّق عقارك باحتراف ونوصلك بالمشتري الجاد
          </h1>

          <p style={viewStyles.description}>
            مكتب نور الضفتين العقاري يقدم خدمات البيع والشراء والتسويق العقاري
            للأراضي والعقارات، مع فريق إداري متخصص للتواصل السريع وخدمة العملاء.
          </p>

          <div style={viewStyles.buttons}>
            <a
              style={viewStyles.whatsapp}
              href={contactData.whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              واتساب المدير
            </a>
            <a style={viewStyles.call} href={`tel:${contactData.phone}`}>
              اتصال مباشر
            </a>
            <a
              style={viewStyles.map}
              href={contactData.maps}
              target="_blank"
              rel="noreferrer"
            >
              الخريطة
            </a>
            <button
              style={viewStyles.cardShareButton}
              type="button"
              onClick={shareOfficeCard}
            >
              مشاركة البطاقة الإلكترونية
            </button>
          </div>
        </div>
      </header>

      <section style={viewStyles.trustStrip} aria-label="مؤشرات المكتب">
        {trustMetrics.map(({ value, label, Icon }) => (
          <div style={viewStyles.trustMetric} key={label}>
            <span style={viewStyles.trustMetricIcon}>
              <Icon size={20} strokeWidth={2.4} />
            </span>
            <strong style={viewStyles.trustMetricValue}>{value}</strong>
            <span style={viewStyles.trustMetricLabel}>{label}</span>
          </div>
        ))}
      </section>

      <section style={viewStyles.liveTicker} aria-label="آخر العروض">
        <div style={viewStyles.liveTickerHead}>
          <RefreshCw size={18} strokeWidth={2.4} />
          <span>آخر العروض</span>
        </div>
        <div style={viewStyles.liveTickerWindow}>
          {activeTickerOffer && (
            <button
              type="button"
              style={viewStyles.liveTickerSpotlight}
              title={`${activeTickerOffer.type} - ${activeTickerOffer.location}`}
              onClick={() => goToOffer(activeTickerOffer.anchor)}
            >
              <small style={viewStyles.liveTickerSource}>
                {activeTickerOffer.sourceLabel}
              </small>
              <strong style={viewStyles.liveTickerType}>{activeTickerOffer.type}</strong>
              <span style={viewStyles.liveTickerLocation}>
                {activeTickerOffer.location}
              </span>
              <b style={viewStyles.liveTickerPrice}>{activeTickerOffer.price}</b>
            </button>
          )}
        </div>
      </section>

      <section style={viewStyles.quickServices} aria-label="خدمات المكتب السريعة">
        {[
          { title: "بيع أراضي", Icon: MapPin },
          { title: "بيع عقارات", Icon: Home },
          { title: "بحث عقاري", Icon: SearchCheck },
          { title: "وساطة موثوقة", Icon: Handshake },
          { title: "إنجاز معاملات", Icon: ShieldCheck },
          { title: "تواصل مباشر", Icon: PhoneCall },
        ].map(({ title, Icon }) => (
          <a style={viewStyles.quickServiceItem} href="#services" key={title}>
            <span style={viewStyles.quickServiceIcon}>
              <Icon size={17} strokeWidth={2.5} />
            </span>
            <strong>{title}</strong>
          </a>
        ))}
      </section>

      <section id="services" style={{ ...viewStyles.section, ...viewStyles.servicesSection }}>
        <div style={viewStyles.sectionHead}>
          <span style={viewStyles.sectionLabel}>خدماتنا</span>
          <h2 style={viewStyles.sectionTitle}>حلول عقارية متكاملة</h2>
          <p style={viewStyles.sectionText}>
            نخدم الملاك والباحثين بعروض واضحة وتواصل مباشر.
          </p>
        </div>

        <div style={viewStyles.grid4}>
          {[
            [
              "🏞️",
              "بيع وشراء الأراضي",
              "تسويق الأراضي السكنية والتجارية والزراعية وربط البائع بالمشتري.",
            ],
            [
              "🏠",
              "بيع وشراء العقارات",
              "عرض المنازل والشقق والمزارع والمحلات بطريقة جذابة واحترافية.",
            ],
            [
              "🔎",
              "البحث عن فرص عقارية",
              "مساعدة العملاء في العثور على العقار المناسب حسب الموقع والميزانية.",
            ],
            [
              "🤝",
              "وساطة عقارية موثوقة",
              "تسهيل التواصل بين الأطراف وتنظيم خطوات البيع والشراء بوضوح.",
            ],
            [
              "📋",
              "خدمات عامة وعقارية",
              "حلول مساندة لإنجاز المعاملات العقارية والخدمات العامة بكفاءة واحترافية.",
            ],
            [
              "📐",
              "خدمات مساحية معتمدة",
              "فرز وتحديد الأراضي بدقة عبر مساحين معتمدين ذوي خبرة عالية.",
            ],
            [
              "👨‍💼",
              "مندوبون لإنجاز المعاملات",
              "نختصر عليك الوقت ونساعدك في إنجاز الإجراءات بسلاسة وموثوقية.",
            ],
      
            
          ].map(([icon, title, text]) => (
            <article className="service-card" style={viewStyles.card} key={title}>
              <div style={viewStyles.iconBox}>{icon}</div>
              <h3 style={viewStyles.cardTitle}>{title}</h3>
              <p style={viewStyles.cardText}>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="marketing-request"
        style={{
          ...viewStyles.requestSection,
          ...(!showMarketingForm ? viewStyles.requestSectionCompact : {}),
        }}
      >
        <div style={viewStyles.requestIntro}>
          <span style={viewStyles.sectionLabel}>خدمة متاحة بالمكتب</span>
          <h2 style={viewStyles.requestTitle}>سوّق عقارك معنا</h2>
          <p style={viewStyles.requestText}>
            أرسل بيانات الأرض أو العقار، وسيقوم فريق مكتب نور الضفتين بمراجعة الطلب
            والتواصل معك لتجهيز العرض وتسويقه باحتراف.
          </p>
          <button
            type="button"
            style={viewStyles.requestToggleButton}
            onClick={() => setShowMarketingForm((current) => !current)}
          >
            {showMarketingForm ? "إخفاء نموذج الطلب" : "فتح نموذج طلب التسويق"}
          </button>
        </div>

        {showMarketingForm && (
        <form style={viewStyles.requestForm} onSubmit={submitMarketingRequest}>
          <div style={viewStyles.formRow}>
            <input
              style={viewStyles.input}
              placeholder="اسم صاحب الطلب"
              value={marketingRequest.ownerName}
              onChange={(e) => updateMarketingRequest("ownerName", e.target.value)}
            />
            <input
              style={viewStyles.input}
              placeholder="رقم التواصل / واتساب"
              value={marketingRequest.phone}
              onChange={(e) => updateMarketingRequest("phone", e.target.value)}
            />
          </div>

          <div style={viewStyles.formRow}>
            <select
              style={viewStyles.input}
              value={marketingRequest.propertyType}
              onChange={(e) => updateMarketingRequest("propertyType", e.target.value)}
            >
              <option value="">نوع العقار</option>
              <option value="أرض">أرض</option>
              <option value="منزل">منزل</option>
              <option value="شقة">شقة</option>
              <option value="مزرعة">مزرعة</option>
              <option value="محل / تجاري">محل / تجاري</option>
              <option value="عقار آخر">عقار آخر</option>
            </select>
            <input
              style={viewStyles.input}
              placeholder="المنطقة / الحوض / الموقع"
              value={marketingRequest.location}
              onChange={(e) => updateMarketingRequest("location", e.target.value)}
            />
          </div>

          <div style={viewStyles.formRow}>
            <input
              style={viewStyles.input}
              placeholder="المساحة"
              value={marketingRequest.area}
              onChange={(e) => updateMarketingRequest("area", e.target.value)}
            />
            <input
              style={viewStyles.input}
              placeholder="السعر المطلوب"
              value={marketingRequest.price}
              onChange={(e) => updateMarketingRequest("price", e.target.value)}
            />
          </div>

          <div style={viewStyles.formRow}>
            <select
              style={viewStyles.input}
              value={marketingRequest.exclusive}
              onChange={(e) => updateMarketingRequest("exclusive", e.target.value)}
            >
              <option value="غير محدد">هل العرض حصري للمكتب؟</option>
              <option value="نعم، حصري للمكتب">نعم، حصري للمكتب</option>
              <option value="لا، عرض تسويقي عام">لا، عرض تسويقي عام</option>
            </select>
            <div style={viewStyles.requestFileBox}>
              <span style={viewStyles.fileLabel}>صورة الصك أو الكروكي</span>
              <input
                style={viewStyles.fileInput}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) =>
                  updateMarketingRequest("attachment", e.target.files?.[0] || null)
                }
              />
            </div>
          </div>

          <textarea
            style={viewStyles.textarea}
            placeholder="تفاصيل إضافية عن العقار، الشوارع، الخدمات، الملاحظات..."
            value={marketingRequest.details}
            onChange={(e) => updateMarketingRequest("details", e.target.value)}
          />

          <p style={viewStyles.requestHint}>
            عند الإرسال ستفتح رسالة واتساب جاهزة للمكتب. إذا تعذر رفع المرفق، أرسله
            يدويًا في نفس المحادثة.
          </p>

          <button style={viewStyles.requestButton} type="submit" disabled={loading}>
            إرسال طلب التسويق عبر واتساب
          </button>
        </form>
        )}
      </section>

      <section style={{ display: "none" }}>
        <div style={viewStyles.facebookContent}>
          <h2 style={viewStyles.facebookTitle}>تابع أحدث العروض العقارية</h2>
          <p style={viewStyles.facebookText}>
            تابعوا صفحة مكتب نور الضفتين العقاري على فيسبوك للاطلاع على أحدث
            الأراضي والعقارات المتوفرة أولًا بأول.
          </p>
        </div>

        <a
          style={viewStyles.facebookButton}
          href={contactData.facebook}
          target="_blank"
          rel="noreferrer"
        >
          متابعة صفحة فيسبوك
        </a>
      </section>

      {user && showAdminDash && (
        <section id="admin" style={viewStyles.adminDashboard}>
          <div style={viewStyles.dashboardHeader}>
            <h2 style={viewStyles.dashboardTitle}>⚙️ لوحة الإدارة</h2>
            <button
              style={viewStyles.closeBtn}
              onClick={() => setShowAdminDash(false)}
            >
              ✕
            </button>
          </div>

          <div style={viewStyles.tabs}>
            <button
              style={{
                ...viewStyles.tabBtn,
                ...(activeTab === "properties" ? viewStyles.tabBtnActive : {}),
              }}
              onClick={() => setActiveTab("properties")}
            >
              📋 العروض
            </button>

            {can("manage_team") && (
              <button
                style={{
                  ...viewStyles.tabBtn,
                  ...(activeTab === "team" ? viewStyles.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab("team")}
              >
                👥 الموظفون
              </button>
            )}

            {can("edit_contact") && (
              <button
                style={{
                  ...viewStyles.tabBtn,
                  ...(activeTab === "contact" ? viewStyles.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab("contact")}
              >
                📞 التواصل
              </button>
            )}
          </div>

          {activeTab === "properties" && (
            <div style={viewStyles.tabContent}>
              <h3 style={viewStyles.tabTitle}>إدارة العروض العقارية</h3>

              <form style={viewStyles.form} onSubmit={saveProperty}>
                <div style={viewStyles.formRow}>
                  <input
                    style={viewStyles.input}
                    placeholder="نوع العقار"
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value })
                    }
                  />

                  <input
                    style={viewStyles.input}
                    placeholder="الموقع"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                  />
                </div>

                <div style={viewStyles.formRow}>
                  <input
                    style={viewStyles.input}
                    placeholder="المساحة"
                    value={form.size}
                    onChange={(e) =>
                      setForm({ ...form, size: e.target.value })
                    }
                  />

                  <input
                    style={viewStyles.input}
                    placeholder="السعر"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                  />
                </div>

                <div style={viewStyles.formRow}>
                  <input
                    style={viewStyles.input}
                    placeholder="رقم التواصل"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />

                  <select
                    style={viewStyles.input}
                    value={form.badge}
                    onChange={(e) =>
                      setForm({ ...form, badge: e.target.value })
                    }
                  >
                    <option value="عادي">عادي</option>
                    <option value="⭐ مميز">⭐ مميز</option>
                    <option value="🔥 تخفيض">🔥 تخفيض</option>
                    <option value="💎 فرصة عقارية">💎 فرصة عقارية</option>
                    <option value="🆕 جديد">🆕 جديد</option>
                    <option value="✅ متاح">✅ متاح</option>
                    <option value="⛔ محجوز">⛔ محجوز</option>
                    <option value="🏁 مباع">🏁 مباع</option>
                  </select>
                </div>

                <textarea
                  style={viewStyles.textarea}
                  placeholder="ملاحظات إضافية"
                  value={form.note}
                  onChange={(e) =>
                    setForm({ ...form, note: e.target.value })
                  }
                />

                <div style={viewStyles.formRow}>
                  <select
                    style={viewStyles.input}
                    value={form.sourceType}
                    onChange={(e) =>
                      setForm({ ...form, sourceType: e.target.value })
                    }
                  >
                    <option value="office">عرض خاص بالمكتب</option>
                    <option value="published">عرض تسويقي منشور</option>
                    <option value="marketing">وساطة تسويقية</option>
                  </select>

                  <input
                    style={viewStyles.input}
                    placeholder="اسم المصدر أو المسوق"
                    value={form.sourceName}
                    onChange={(e) =>
                      setForm({ ...form, sourceName: e.target.value })
                    }
                  />
                </div>

                <div style={viewStyles.formRow}>
                  <input
                    style={viewStyles.input}
                    placeholder="رابط مصدر العرض"
                    value={form.sourceUrl}
                    onChange={(e) =>
                      setForm({ ...form, sourceUrl: e.target.value })
                    }
                  />

                  <input
                    style={viewStyles.input}
                    type="date"
                    value={form.sourceCheckedAt}
                    onChange={(e) =>
                      setForm({ ...form, sourceCheckedAt: e.target.value })
                    }
                  />
                </div>

                <label style={viewStyles.checkboxLine}>
                  <input
                    type="checkbox"
                    checked={form.sourceConsent}
                    onChange={(e) =>
                      setForm({ ...form, sourceConsent: e.target.checked })
                    }
                  />
                  تم التحقق من المصدر أو أخذ موافقة مبدئية على التسويق
                </label>

                <div style={viewStyles.fileInputWrapper}>
                  <label style={viewStyles.fileLabel}>📸 صورة العقار:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePropertyImageUpload}
                    style={viewStyles.fileInput}
                  />
                </div>

                <div style={viewStyles.formRow}>
                  <button style={viewStyles.addButton} type="submit">
                    {editingProperty ? "حفظ التعديل" : "إضافة عرض"}
                  </button>

                  {editingProperty && (
                    <button
                      style={viewStyles.cancelButton}
                      type="button"
                      onClick={resetPropertyForm}
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>

              <div style={viewStyles.propertyList}>
                <h3 style={viewStyles.listTitle}>
                  قائمة العروض ({properties.length})
                </h3>

                {properties.map((prop) => (
                  <div key={prop.id} style={viewStyles.propertyListItem}>
                    <div>
                      <strong style={viewStyles.propTitle}>
                        {prop.badge !== "عادي" ? `${prop.badge} • ` : ""}
                        {prop.type}
                      </strong>
                      <p style={viewStyles.propInfo}>الموقع: {prop.location}</p>
                      <p style={viewStyles.propInfo}>المساحة: {prop.size}</p>
                      <p style={viewStyles.propInfo}>السعر: {prop.price}</p>
                      <small style={viewStyles.propMeta}>
                        أضيف بواسطة: {prop.createdBy || "الإدارة"}
                      </small>
                      {isMarketingSource(prop.sourceType) && (
                        <small style={viewStyles.propMeta}>
                          {sourceTypeLabel(prop.sourceType)}
                          {prop.sourceName ? ` - ${prop.sourceName}` : ""}
                        </small>
                      )}
                      {prop.updatedBy && (
                        <small style={viewStyles.propMeta}>
                          آخر تعديل بواسطة: {prop.updatedBy}
                        </small>
                      )}
                    </div>

                    <div style={viewStyles.propActions}>
                      <button
                        style={viewStyles.shareBtn}
                        onClick={() => shareProperty(prop)}
                      >
                        مشاركة
                      </button>

                      <button
                        style={viewStyles.copyBtn}
                        onClick={() => copyPropertyLink(prop)}
                      >
                        نسخ
                      </button>

                      {can("edit") && (
                        <button
                          style={viewStyles.editBtn}
                          onClick={() => editProperty(prop)}
                        >
                          تعديل
                        </button>
                      )}

                      {can("delete") && (
                        <button
                          style={viewStyles.deleteBtn}
                          onClick={() => deleteProperty(prop.id)}
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "team" && can("manage_team") && (
            <div style={viewStyles.tabContent}>
              <h3 style={viewStyles.tabTitle}>إدارة الموظفين</h3>

              <form style={viewStyles.form} onSubmit={saveEmployee}>
                <div style={viewStyles.formRow}>
                  <input
                    style={viewStyles.input}
                    placeholder="اسم الموظف"
                    value={employeeForm.name}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        name: e.target.value,
                      })
                    }
                  />

                  <input
                    style={viewStyles.input}
                    placeholder="المسمى الوظيفي"
                    value={employeeForm.title}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        title: e.target.value,
                      })
                    }
                  />
                </div>

                <div style={viewStyles.formRow}>
                  <input
                    style={viewStyles.input}
                    placeholder="رقم الهاتف"
                    value={employeeForm.phone}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        phone: e.target.value,
                      })
                    }
                  />

                  <input
                    style={viewStyles.input}
                    placeholder="البريد الإلكتروني"
                    value={employeeForm.email}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        email: e.target.value,
                      })
                    }
                  />
                </div>

                <input
                  style={viewStyles.input}
                  placeholder="رابط واتساب"
                  value={employeeForm.whatsapp}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      whatsapp: e.target.value,
                    })
                  }
                />

                <div style={viewStyles.fileInputWrapper}>
                  <label style={viewStyles.fileLabel}>👤 صورة الموظف:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEmployeePhotoUpload}
                    style={viewStyles.fileInput}
                  />
                </div>

                {employeeForm.photo && (
                  <div style={viewStyles.employeePhotoPreviewBox}>
                    <img
                      src={employeeForm.photo}
                      alt="معاينة"
                      style={viewStyles.employeePhotoPreview}
                    />
                  </div>
                )}

                <div style={viewStyles.formRow}>
                  <button style={viewStyles.addButton} type="submit">
                    {editingEmployee ? "حفظ بيانات الموظف" : "إضافة موظف"}
                  </button>

                  {editingEmployee && (
                    <button
                      style={viewStyles.cancelButton}
                      type="button"
                      onClick={() => {
                        setEditingEmployee(null);
                        setEmployeeForm({
                          name: "",
                          title: "",
                          phone: "",
                          email: "",
                          whatsapp: "",
                          photo: "",
                        });
                      }}
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>

              <div style={viewStyles.employeeList}>
                {team.map((emp) => (
                  <div key={emp.id} style={viewStyles.employeeCard}>
                    <div style={viewStyles.employeeCardInfo}>
                      <div style={viewStyles.employeeMiniPhotoBox}>
                        {emp.photo ? (
                          <img
                            src={emp.photo}
                            alt={emp.name}
                            style={viewStyles.employeeMiniPhoto}
                          />
                        ) : (
                          <span>👤</span>
                        )}
                      </div>

                      <div>
                        <h4 style={viewStyles.empName}>{emp.name}</h4>
                        <p style={viewStyles.jobTitle}>{emp.title}</p>
                        <p style={viewStyles.empContact}>الهاتف: {emp.phone}</p>
                      </div>
                    </div>

                    <div style={viewStyles.empActions}>
                      <button
                        style={viewStyles.editBtn}
                        onClick={() => {
                          setEditingEmployee(emp);
                          setEmployeeForm(emp);
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        style={viewStyles.deleteBtn}
                        onClick={() => deleteEmployee(emp.id)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "contact" && can("edit_contact") && (
            <div style={viewStyles.tabContent}>
              <h3 style={viewStyles.tabTitle}>بيانات التواصل</h3>

              <form
                style={viewStyles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  saveContact(contactData);
                  alert("تم حفظ بيانات التواصل");
                }}
              >
                <input
                  style={viewStyles.input}
                  placeholder="رقم الهاتف الرئيسي"
                  value={contactData.phone}
                  onChange={(e) =>
                    setContactData({
                      ...contactData,
                      phone: e.target.value,
                    })
                  }
                />

                <input
                  style={viewStyles.input}
                  placeholder="رابط واتساب"
                  value={contactData.whatsapp}
                  onChange={(e) =>
                    setContactData({
                      ...contactData,
                      whatsapp: e.target.value,
                    })
                  }
                />

                <input
                  style={viewStyles.input}
                  placeholder="رابط فيسبوك"
                  value={contactData.facebook}
                  onChange={(e) =>
                    setContactData({
                      ...contactData,
                      facebook: e.target.value,
                    })
                  }
                />

                <input
                  style={viewStyles.input}
                  placeholder="رابط الخريطة"
                  value={contactData.maps}
                  onChange={(e) =>
                    setContactData({
                      ...contactData,
                      maps: e.target.value,
                    })
                  }
                />

                <button style={viewStyles.addButton} type="submit">
                  حفظ البيانات
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      <section id="properties" style={{ ...viewStyles.section, order: 5 }}>
        <div style={viewStyles.sectionHead}>
          <span style={viewStyles.sectionLabel}>العروض العقارية</span>
          <h2 style={viewStyles.sectionTitle}>العروض المتاحة</h2>
          <p style={viewStyles.sectionText}>
            أحدث العروض العقارية المتاحة للبيع والشراء
          </p>
        </div>

        <div style={viewStyles.filterBar} aria-label="تصفية كل العروض">
          {offerFilters.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              style={{
                ...viewStyles.filterButton,
                ...(offerFilter === id ? viewStyles.filterButtonActive : {}),
              }}
              onClick={() => setOfferFilter(id)}
            >
              <Icon size={16} strokeWidth={2.4} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div style={viewStyles.propertyGrid}>
          {filteredProperties.map((item) => (
            <article
              id={`office-offer-${item.id}`}
              style={viewStyles.propertyCard}
              key={item.id}
            >
              <div style={viewStyles.propertyImageWrapper}>
                <div style={viewStyles.propertyImage}>
                  {(item.image?.startsWith("data:image") || item.image?.startsWith("http")) ? (
                    <img
                      src={item.image}
                      alt={item.type}
                      style={viewStyles.propertyUploadedImage}
                    />
                  ) : (
                    item.image || "🏡"
                  )}
                </div>

                {item.badge && item.badge !== "عادي" && (
                  <div style={viewStyles.badgeLabel}>{item.badge}</div>
                )}
                {isMarketingSource(item.sourceType) && (
                  <div style={viewStyles.sourceLabel}>
                    {sourceTypeLabel(item.sourceType)}
                  </div>
                )}
              </div>

              <div style={viewStyles.propertyBody}>
                <h3 style={viewStyles.cardTitle}>{item.type}</h3>
                <p style={viewStyles.propertyLine}>
                  <span style={viewStyles.propertyLineIcon}>📍</span>
                  <span>{item.location}</span>
                </p>
                <p style={viewStyles.propertyLine}>
                  <span style={viewStyles.propertyLineIcon}>📐</span>
                  <span>{item.size}</span>
                </p>
                <p style={viewStyles.propertyLine}>
                  <span style={viewStyles.propertyLineIcon}>💰</span>
                  <span>{item.price}</span>
                </p>
                {item.note && (
                  <p style={viewStyles.propertyNote}>
                    <span style={viewStyles.propertyNoteIcon}>✨</span>
                    <span>{item.note}</span>
                  </p>
                )}
                {isMarketingSource(item.sourceType) && (
                  <div style={viewStyles.sourceNotice}>
                    <strong>{sourceTypeLabel(item.sourceType)}</strong>
                    <span>
                      عرض من مصدر معلن، ويتم التحقق من التفاصيل قبل أي تواصل أو اتفاق. لا يعد العرض حصريًا لمكتب نور الضفتين إلا إذا ذكر ذلك صراحة.
                    </span>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={viewStyles.sourceLink}
                      >
                        رابط المصدر
                      </a>
                    )}
                  </div>
                )}

                <div style={viewStyles.propertyButtons}>
                  <a
                    style={{ ...viewStyles.whatsapp, ...viewStyles.cardActionButton }}
                    href={propertyWhatsAppUrl(item)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    استفسار عن العرض
                  </a>

                  <button
                    style={{ ...viewStyles.shareBtnLarge, ...viewStyles.cardActionButton }}
                    onClick={() => shareProperty(item)}
                  >
                    مشاركة
                  </button>

                  <a
                    style={{ ...viewStyles.call, ...viewStyles.cardActionButton }}
                    href={`tel:${item.phone}`}
                  >
                    اتصال
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!filteredProperties.length && (
          <p style={viewStyles.emptyState}>لا توجد عروض ضمن هذا التصنيف حاليا.</p>
        )}
      </section>

      <section id="external-offers" style={viewStyles.externalSection}>
        <div style={viewStyles.sectionHead}>
          <span style={viewStyles.sectionLabel}>وساطة تسويقية</span>
          <h2 style={viewStyles.sectionTitle}>عروض تسويقية خارجية في إربد ومناطقها</h2>
          <p style={viewStyles.sectionText}>
            فرص معلنة من مصادر عامة نجمعها للمتابعة الأولية. يتحقق المكتب من توفر العرض وتفاصيله قبل أي تواصل أو اتفاق.
          </p>
        </div>

        <div style={viewStyles.externalGrid}>
          {filteredExternalOffers.map((offer) => (
            <article
              id={`external-offer-${offer.id}`}
              style={viewStyles.externalCard}
              key={offer.id}
            >
              <div style={viewStyles.externalCardHead}>
                <span style={viewStyles.externalTag}>وساطة تسويقية</span>
                <span style={viewStyles.externalDate}>
                  تحقق: {offer.checkedAt}
                </span>
              </div>

              <h3 style={viewStyles.cardTitle}>{offer.type}</h3>
              <p style={viewStyles.propertyLine}>
                <span style={viewStyles.propertyLineIcon}>📍</span>
                <span>{offer.location}</span>
              </p>
              <p style={viewStyles.propertyLine}>
                <span style={viewStyles.propertyLineIcon}>📐</span>
                <span>{offer.size}</span>
              </p>
              <p style={viewStyles.propertyLine}>
                <span style={viewStyles.propertyLineIcon}>💰</span>
                <span>{offer.price}</span>
              </p>
              <p style={viewStyles.propertyNote}>{offer.note}</p>

              <div style={viewStyles.sourceNotice}>
                <strong>{offer.sourceName}</strong>
                <span>
                  العرض من مصدر معلن، ولا يعد حصريًا لمكتب نور الضفتين. يتم التحقق من التفاصيل والموافقة قبل التسويق المباشر.
                </span>
              </div>

              <div style={viewStyles.propertyButtons}>
                <a
                  style={{ ...viewStyles.map, ...viewStyles.cardActionButton }}
                  href={offer.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  فتح المصدر
                </a>
                <a
                  style={{ ...viewStyles.whatsapp, ...viewStyles.cardActionButton }}
                  href={propertyWhatsAppUrl(offer)}
                  target="_blank"
                  rel="noreferrer"
                >
                  استفسار عبر المكتب
                </a>
              </div>
            </article>
          ))}
        </div>
        {!filteredExternalOffers.length && (
          <p style={viewStyles.emptyState}>لا توجد عروض خارجية ضمن هذا التصنيف حاليا.</p>
        )}

      </section>

      <section style={viewStyles.assuranceSection}>
        <div style={viewStyles.assuranceHeader}>
          <span style={viewStyles.sectionLabel}>ثقة ووضوح</span>
          <h2 style={viewStyles.assuranceMainTitle}>لماذا نور الضفتين؟</h2>
        </div>

        <div style={viewStyles.assuranceGrid}>
          {assuranceItems.map(({ title, text, Icon }) => (
            <article style={viewStyles.assuranceItem} key={title}>
              <span style={viewStyles.assuranceIcon}>
                <Icon size={18} strokeWidth={2.4} />
              </span>
              <div>
                <h3 style={viewStyles.assuranceTitle}>{title}</h3>
                <p style={viewStyles.assuranceText}>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="team" style={viewStyles.darkSection}>
        <div style={viewStyles.inner}>
          <div style={viewStyles.sectionHeadLight}>
            <span style={viewStyles.goldLabel}>فريق التواصل</span>
            <h2 style={viewStyles.darkTitle}>إدارة متخصصة لخدمتكم</h2>
            <p style={viewStyles.darkText}>
              أرقام مباشرة لكل مسؤول لتسهيل الاستفسارات والعروض العقارية
              والتنسيق مع العملاء.
            </p>
          </div>

          <div style={viewStyles.teamGrid}>
            {team.map((person) => (
              <article style={viewStyles.teamCard} key={person.id}>
                <div style={viewStyles.teamPhotoBox}>
                  {person.photo ? (
                    <img
                      src={person.photo}
                      alt={person.name}
                      style={viewStyles.teamPhoto}
                    />
                  ) : (
                    <span style={viewStyles.teamFallbackIcon}>👤</span>
                  )}
                </div>

                <p style={viewStyles.job}>{person.title}</p>
                <h3 style={viewStyles.name}>{person.name}</h3>
                <p style={viewStyles.phone}>{person.phone}</p>

                <div style={viewStyles.buttons}>
                  <a
                    style={viewStyles.whatsapp}
                    href={
                      person.whatsapp ||
                      `https://wa.me/${normalPhone(person.phone)}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    واتساب
                  </a>
                  <a style={viewStyles.outline} href={`tel:${person.phone}`}>
                    اتصال
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: "none" }}>
        <div>
          <h2 style={viewStyles.facebookPromoTitle}>
            🎯 تابع أحدث عروضنا على فيسبوك
          </h2>
          <p style={viewStyles.facebookPromoText}>
            لا تفوت أي عرض جديد! تابع صفحتنا على فيسبوك والتي نحدثها بأحدث
            العروض العقارية والفرص الاستثمارية المتاحة.
          </p>
        </div>

        <a
          style={viewStyles.facebookPromoButton}
          href={contactData.facebook}
          target="_blank"
          rel="noreferrer"
        >
          متابعة فيسبوك
        </a>
      </section>

      <section id="promo" style={{ ...viewStyles.section, order: 11 }}>
        <div style={viewStyles.sectionHead}>
          <span style={viewStyles.sectionLabel}>QR Code</span>
          <h2 style={viewStyles.sectionTitle}>بطاقة المكتب الإلكترونية</h2>
          <p style={viewStyles.sectionText}>
            عند مسح الباركود تظهر صفحة فيها أرقام التواصل وروابط المكتب
          </p>
        </div>

        <div style={viewStyles.promo}>
          <div>
            <span style={viewStyles.badge}>امسح الباركود واحفظ بيانات المكتب</span>
            <h2 style={viewStyles.promoTitle}>مكتب نور الضفتين العقاري</h2>
            <p style={viewStyles.promoText}>
              بيع وشراء الأراضي والعقارات، وتسويق العروض العقارية باحترافية
              وسرعة في التواصل.
            </p>

            <div style={viewStyles.infoBox}>
              {team.map((person) => (
                <p key={person.id} style={viewStyles.infoLine}>
                  <strong>{person.title}</strong> - {person.name}:{" "}
                  {person.phone}
                </p>
              ))}
            </div>

            <div style={viewStyles.buttons}>
              <a
                style={viewStyles.whatsapp}
                href={contactData.whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                واتساب
              </a>
              <a
                style={viewStyles.call}
                href={contactData.facebook}
                target="_blank"
                rel="noreferrer"
              >
                فيسبوك
              </a>
              <a
                style={viewStyles.map}
                href={contactData.maps}
                target="_blank"
                rel="noreferrer"
              >
                الخريطة
              </a>
              <button
                style={viewStyles.cardShareButton}
                type="button"
                onClick={shareOfficeCard}
              >
                مشاركة البطاقة الإلكترونية
              </button>
            </div>
          </div>

          <div style={viewStyles.qrBox}>
            <img src={qrImage} alt="QR Code" style={viewStyles.qr} />
            <h3 style={viewStyles.qrTitle}>امسح الباركود</h3>
            <p style={viewStyles.qrText}>للوصول إلى بيانات المكتب وروابط التواصل.</p>
          </div>
        </div>
      </section>

      <footer id="contact" style={viewStyles.footer}>
        <h2 style={viewStyles.footerTitle}>مكتب  نور الضفتين العقاري</h2>
        <p style={viewStyles.footerText}>
          بيع وشراء الأراضي والعقارات وتسويق العروض العقارية باحترافية.
        </p>

        <div style={viewStyles.footerContacts}>
          {team.map((person) => (
            <a
              key={person.id}
              style={viewStyles.footerLink}
              href={`tel:${person.phone}`}
            >
              {person.title} - {person.name}: {person.phone}
            </a>
          ))}
        </div>

        <div style={viewStyles.buttonsCenter}>
          <a
            style={viewStyles.call}
            href={contactData.facebook}
            target="_blank"
            rel="noreferrer"
          >
            صفحة فيسبوك
          </a>
          <a
            style={viewStyles.map}
            href={contactData.maps}
            target="_blank"
            rel="noreferrer"
          >
            الموقع على الخريطة
          </a>
          <a
            style={viewStyles.whatsapp}
            href={contactData.whatsapp}
            target="_blank"
            rel="noreferrer"
          >
            واتساب
          </a>
          <button
            style={viewStyles.cardShareButton}
            type="button"
            onClick={shareOfficeCard}
          >
            مشاركة البطاقة الإلكترونية
          </button>
        </div>

        <p style={viewStyles.copy}>© جميع الحقوق محفوظة لمكتب نور الضفتين العقاري</p>
      </footer>

      <div style={viewStyles.floating}>
        <a
          style={viewStyles.floatMap}
          href={contactData.maps}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin size={21} strokeWidth={2.6} />
        </a>
        <a
          style={viewStyles.floatWhats}
          href={contactData.whatsapp}
          target="_blank"
          rel="noreferrer"
        >
          <PhoneCall size={21} strokeWidth={2.6} />
        </a>
      </div>
    </main>
  );
}

const styles = {
  page: {
    margin: 0,
    fontFamily: "Tahoma, Arial, sans-serif",
    background: "#f8fafc",
    color: "#0f172a",
    display: "flex",
    flexDirection: "column",
  },

  userBanner: {
    order: 0,
    background: "#10b981",
    color: "white",
    padding: "12px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: "bold",
    fontSize: "14px",
  },

  logoutQuickBtn: {
    background: "rgba(255,255,255,0.3)",
    border: "none",
    color: "white",
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: "8px",
    fontWeight: "900",
  },

  hero: {
    order: 1,
    background:
      "linear-gradient(135deg, #061a44 0%, #0b4aa2 55%, #0284c7 100%)",
    color: "white",
    padding: "24px",
  },

  nav: {
    maxWidth: "1180px",
    margin: "0 auto 24px",
    padding: "14px 18px",
    borderRadius: "22px",
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    position: "sticky",
    top: "10px",
    zIndex: 50,
    backdropFilter: "blur(14px)",
  },

  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    textDecoration: "none",
  },

  logoIcon: {
    width: "48px",
    height: "48px",
    display: "grid",
    placeItems: "center",
    background: "#facc15",
    color: "#061a44",
    borderRadius: "16px",
    fontSize: "24px",
  },

  logo: {
    display: "block",
    fontSize: "26px",
    color: "#facc15",
    fontWeight: "900",
    lineHeight: "1.2",
  },

  subtitle: {
    display: "block",
    marginTop: "4px",
    color: "#dbeafe",
    fontSize: "13px",
  },

  navLinks: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  },

  navLink: {
    color: "white",
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    padding: "10px 13px",
    borderRadius: "14px",
    textDecoration: "none",
    fontWeight: "800",
    fontSize: "14px",
  },

  adminSecretBtn: {
    color: "white",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "16px",
    opacity: 0.7,
  },

  dhikrBar: {
    maxWidth: "1180px",
    margin: "0 auto 18px",
    padding: "10px 16px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(250,204,21,.30)",
    color: "#fef3c7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    boxShadow: "0 12px 32px rgba(0,0,0,.14)",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
  },

  dhikrLabel: {
    background: "#facc15",
    color: "#061a44",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "900",
    flex: "0 0 auto",
  },

  dhikrText: {
    fontSize: "15px",
    fontWeight: "900",
    lineHeight: "1.7",
    textAlign: "center",
    transition: "opacity .25s ease",
  },

  bannerBox: {
    maxWidth: "1180px",
    margin: "0 auto",
    borderRadius: "26px",
    overflow: "hidden",
    boxShadow: "0 25px 70px rgba(0,0,0,.32)",
    border: "1px solid rgba(255,255,255,0.20)",
  },

  banner: {
  width: "100%",
  height: "auto",
  aspectRatio: "16 / 9",
  objectFit: "cover",
  objectPosition: "center",
  display: "block",
  background: "#061a44",
},

  heroContent: {
    maxWidth: "1180px",
    margin: "50px auto 42px",
    textAlign: "center",
  },

  badge: {
    background: "rgba(255,255,255,.14)",
    border: "1px solid rgba(250,204,21,.55)",
    color: "#fde68a",
    padding: "10px 18px",
    borderRadius: "999px",
    fontWeight: "900",
    display: "inline-block",
  },

  title: {
    maxWidth: "560px",
    margin: "10px auto",
    fontSize: "clamp(34px, 6vw, 64px)",
    lineHeight: "1.45",
    fontWeight: "900",
    color: "#ffffff",
  },

  description: {
    maxWidth: "820px",
    margin: "0 auto",
    fontSize: "20px",
    lineHeight: "2",
    color: "#e0f2fe",
  },

  buttons: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "24px",
  },

  buttonsCenter: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "24px",
  },

  whatsapp: {
    background: "#059669",
    color: "white",
    padding: "13px 22px",
    borderRadius: "16px",
    textDecoration: "none",
    fontWeight: "900",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    maxWidth: "100%",
    border: "none",
    cursor: "pointer",
  },

  call: {
    background: "#facc15",
    color: "#071f4f",
    padding: "13px 22px",
    borderRadius: "16px",
    textDecoration: "none",
    fontWeight: "900",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    maxWidth: "100%",
    border: "none",
    cursor: "pointer",
  },

  map: {
    background: "#2563eb",
    color: "white",
    padding: "13px 22px",
    borderRadius: "16px",
    textDecoration: "none",
    fontWeight: "900",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    maxWidth: "100%",
    border: "none",
    cursor: "pointer",
  },

  cardShareButton: {
    background: "linear-gradient(135deg, #111827 0%, #334155 100%)",
    color: "white",
    padding: "13px 22px",
    borderRadius: "16px",
    textDecoration: "none",
    fontWeight: "900",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    maxWidth: "100%",
    border: "1px solid rgba(250,204,21,.55)",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(15,23,42,.18)",
  },

  trustStrip: {
    order: 2,
    maxWidth: "1180px",
    margin: "-30px auto 34px",
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
    position: "relative",
    zIndex: 2,
    boxSizing: "border-box",
  },

  trustMetric: {
    background: "rgba(255,255,255,.97)",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "18px 16px",
    boxShadow: "0 18px 45px rgba(15,23,42,.10)",
    display: "grid",
    gap: "7px",
    justifyItems: "center",
    textAlign: "center",
    minWidth: 0,
  },

  trustMetricIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "14px",
    background: "#eff6ff",
    color: "#0b4aa2",
    display: "grid",
    placeItems: "center",
  },

  trustMetricValue: {
    color: "#061a44",
    fontSize: "18px",
    lineHeight: "1.4",
  },

  trustMetricLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
    lineHeight: "1.5",
  },

  liveTicker: {
    order: 3,
    maxWidth: "1180px",
    margin: "0 auto 18px",
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "120px minmax(0, 1fr)",
    gap: "8px",
    alignItems: "stretch",
    boxSizing: "border-box",
  },

  liveTickerHead: {
    background: "#061a44",
    color: "#facc15",
    borderRadius: "999px",
    padding: "7px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: "900",
    fontSize: "13px",
    boxShadow: "0 12px 26px rgba(6,26,68,.14)",
  },

  liveTickerWindow: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    position: "relative",
    height: "42px",
    display: "flex",
    alignItems: "center",
    direction: "rtl",
  },

  liveTickerSpotlight: {
    width: "100%",
    height: "100%",
    color: "#061a44",
    background: "transparent",
    border: "none",
    padding: "8px 16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    lineHeight: "1.4",
    fontSize: "12px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    direction: "rtl",
    fontFamily: "inherit",
  },

  liveTickerSource: {
    color: "#0b4aa2",
    fontWeight: "900",
    flex: "0 0 auto",
  },

  liveTickerType: {
    fontWeight: "900",
    flex: "0 0 auto",
  },

  liveTickerLocation: {
    minWidth: 0,
    maxWidth: "48%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#334155",
  },

  liveTickerPrice: {
    color: "#061a44",
    fontWeight: "950",
    flex: "0 0 auto",
  },

  quickServices: {
    order: 4,
    maxWidth: "1180px",
    margin: "0 auto 24px",
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "10px",
    boxSizing: "border-box",
  },

  quickServiceItem: {
    minWidth: 0,
    background: "rgba(255,255,255,.98)",
    border: "1px solid #dbeafe",
    borderRadius: "16px",
    padding: "12px 8px",
    textDecoration: "none",
    color: "#061a44",
    display: "grid",
    justifyItems: "center",
    gap: "7px",
    fontSize: "12px",
    fontWeight: "900",
    textAlign: "center",
    boxShadow: "0 10px 24px rgba(15,23,42,.055)",
  },

  quickServiceIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "13px",
    background: "#eff6ff",
    color: "#0b4aa2",
    display: "grid",
    placeItems: "center",
  },

  assuranceSection: {
    order: 10,
    maxWidth: "1180px",
    margin: "18px auto 42px",
    padding: "0 24px",
    boxSizing: "border-box",
  },

  assuranceHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },

  assuranceMainTitle: {
    color: "#061a44",
    fontSize: "22px",
    fontWeight: "900",
    margin: 0,
  },

  assuranceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
  },

  assuranceItem: {
    background: "white",
    border: "1px solid #dbeafe",
    borderRadius: "14px",
    padding: "14px",
    boxShadow: "0 8px 22px rgba(15,23,42,.05)",
    minWidth: 0,
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },

  assuranceIcon: {
    width: "34px",
    minWidth: "34px",
    height: "34px",
    borderRadius: "12px",
    background: "#0b4aa2",
    color: "#facc15",
    display: "grid",
    placeItems: "center",
  },

  assuranceTitle: {
    color: "#061a44",
    fontSize: "14px",
    fontWeight: "900",
    margin: "0 0 4px",
  },

  assuranceText: {
    color: "#475569",
    fontSize: "12px",
    lineHeight: "1.7",
  },

  outline: {
    background: "transparent",
    border: "2px solid white",
    color: "white",
    padding: "10px 16px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "bold",
    display: "inline-block",
    cursor: "pointer",
  },

  section: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "64px 24px",
    scrollMarginTop: "120px",
  },

  sectionHead: {
    textAlign: "center",
    marginBottom: "48px",
  },

  sectionLabel: {
    color: "#0284c7",
    fontWeight: "900",
    fontSize: "14px",
  },

  sectionTitle: {
    fontSize: "clamp(28px, 4vw, 48px)",
    fontWeight: "900",
    marginBottom: "16px",
    color: "#061a44",
  },

  sectionText: {
    fontSize: "16px",
    color: "#475569",
    maxWidth: "500px",
    margin: "0 auto",
    lineHeight: "1.6",
  },

  servicesSection: {
    order: 8,
    paddingTop: "20px",
    paddingBottom: "42px",
  },

  grid4: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "16px",
  },

  card: {
    background: "white",
    padding: "18px",
    borderRadius: "16px",
    boxShadow: "0 10px 26px rgba(15,23,42,.055)",
    textAlign: "right",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "46px minmax(0, 1fr)",
    gap: "14px",
    alignItems: "start",
    minHeight: "132px",
    transition: "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
  },

  iconBox: {
    width: "46px",
    height: "46px",
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    fontSize: "22px",
    margin: 0,
    border: "1px solid #bfdbfe",
    gridRow: "1 / span 2",
  },

  cardTitle: {
    fontSize: "17px",
    fontWeight: "900",
    margin: "0 0 5px",
    color: "#061a44",
    lineHeight: "1.45",
    gridColumn: "2",
  },

  cardText: {
    fontSize: "14px",
    color: "#475569",
    lineHeight: "1.9",
    overflowWrap: "anywhere",
    gridColumn: "2",
  },

  requestSection: {
    order: 7,
    maxWidth: "1180px",
    margin: "0 auto 64px",
    padding: "42px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, #061a44 0%, #0b4aa2 100%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "0.75fr 1.25fr",
    gap: "28px",
    alignItems: "start",
    boxShadow: "0 22px 60px rgba(15,23,42,.16)",
    border: "1px solid rgba(250,204,21,.30)",
    scrollMarginTop: "120px",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  requestSectionCompact: {
    gridTemplateColumns: "1fr",
    textAlign: "center",
    padding: "34px 42px",
  },

  requestIntro: {
    textAlign: "right",
  },

  requestTitle: {
    fontSize: "34px",
    lineHeight: "1.35",
    fontWeight: "900",
    margin: "10px 0 12px",
    color: "#facc15",
  },

  requestText: {
    color: "#dbeafe",
    fontSize: "16px",
    lineHeight: "1.9",
  },

  requestToggleButton: {
    marginTop: "18px",
    background: "#facc15",
    color: "#061a44",
    border: "none",
    borderRadius: "14px",
    padding: "13px 22px",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(250,204,21,.22)",
  },

  requestForm: {
    background: "rgba(255,255,255,.96)",
    color: "#0f172a",
    borderRadius: "18px",
    padding: "22px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    border: "1px solid rgba(255,255,255,.45)",
    boxSizing: "border-box",
  },

  requestFileBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    background: "white",
    boxSizing: "border-box",
    minWidth: 0,
  },

  requestHint: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    lineHeight: "1.7",
    textAlign: "center",
  },

  requestButton: {
    background: "#059669",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "14px 18px",
    fontWeight: "900",
    cursor: "pointer",
    fontSize: "15px",
    boxShadow: "0 12px 26px rgba(5,150,105,.22)",
  },

  facebookCta: {
    order: 9,
    maxWidth: "1180px",
    margin: "0 auto 64px",
    padding: "48px",
    background: "#f0f9ff",
    borderRadius: "24px",
    display: "none",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "32px",
    flexWrap: "wrap",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  facebookContent: {
    minWidth: 0,
    flex: "1 1 320px",
  },

  facebookTitle: {
    fontSize: "28px",
    fontWeight: "900",
    marginBottom: "12px",
    color: "#061a44",
  },

  facebookText: {
    color: "#475569",
    fontSize: "16px",
    lineHeight: "1.6",
  },

  facebookButton: {
    background: "#1f2937",
    color: "white",
    padding: "16px 32px",
    borderRadius: "16px",
    textDecoration: "none",
    fontWeight: "900",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    maxWidth: "100%",
    textAlign: "center",
    lineHeight: "1.5",
  },

  adminDashboard: {
    order: 99,
    maxWidth: "1180px",
    margin: "64px auto",
    padding: "32px",
    background: "white",
    borderRadius: "24px",
    boxShadow: "0 10px 40px rgba(15,23,42,.12)",
    border: "2px solid #dbeafe",
  },

  dashboardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
    paddingBottom: "24px",
    borderBottom: "2px solid #e2e8f0",
  },

  dashboardTitle: {
    margin: 0,
    color: "#061a44",
  },

  closeBtn: {
    background: "#ef4444",
    color: "white",
    border: "none",
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  tabs: {
    display: "flex",
    gap: "12px",
    marginBottom: "32px",
    flexWrap: "wrap",
    borderBottom: "2px solid #e2e8f0",
    paddingBottom: "12px",
  },

  tabBtn: {
    background: "transparent",
    border: "2px solid #cbd5e1",
    color: "#475569",
    padding: "10px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
  },

  tabBtnActive: {
    background: "#0284c7",
    color: "white",
    borderColor: "#0284c7",
  },

  tabContent: {
    marginTop: "24px",
  },

  tabTitle: {
    fontSize: "22px",
    fontWeight: "900",
    color: "#061a44",
    marginBottom: "24px",
    borderBottom: "3px solid #0284c7",
    paddingBottom: "12px",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "32px",
    padding: "24px",
    background: "#f8fafc",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
  },

  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "16px",
  },

  input: {
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    fontFamily: "Tahoma, Arial",
  },

  textarea: {
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    fontFamily: "Tahoma, Arial",
    minHeight: "100px",
    resize: "vertical",
  },

  fileInputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "white",
    borderRadius: "8px",
    flexWrap: "wrap",
  },

  fileLabel: {
    fontWeight: "bold",
    color: "#475569",
  },

  fileInput: {
    flex: 1,
  },

  checkboxLine: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    background: "white",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    color: "#334155",
    fontSize: "14px",
    fontWeight: "700",
  },

  addButton: {
    background: "#10b981",
    color: "white",
    padding: "12px 24px",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
  },

  cancelButton: {
    background: "#ef4444",
    color: "white",
    padding: "12px 24px",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
  },

  propertyList: {
    marginTop: "32px",
  },

  listTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#061a44",
    marginBottom: "20px",
  },

  propertyListItem: {
    background: "white",
    padding: "20px",
    marginBottom: "16px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },

  propTitle: {
    fontSize: "15px",
    color: "#0b4aa2",
    display: "block",
    marginBottom: "6px",
  },

  propInfo: {
    fontSize: "13px",
    color: "#475569",
    margin: "2px 0",
  },

  propMeta: {
    fontSize: "12px",
    color: "#94a3b8",
    display: "block",
    marginTop: "4px",
  },

  propActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  shareBtn: {
    background: "#0284c7",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
  },

  shareBtnLarge: {
    background: "#0284c7",
    color: "white",
    padding: "12px 18px",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "900",
  },

  copyBtn: {
    background: "#8b5cf6",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
  },

  editBtn: {
    background: "#f59e0b",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
  },

  deleteBtn: {
    background: "#ef4444",
    color: "white",
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
  },

  employeeList: {
    marginTop: "32px",
  },

  employeeCard: {
    background: "white",
    padding: "20px",
    marginBottom: "16px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },

  employeeCardInfo: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  employeeMiniPhotoBox: {
    width: "58px",
    height: "58px",
    borderRadius: "50%",
    overflow: "hidden",
    background: "#e2e8f0",
    display: "grid",
    placeItems: "center",
    border: "2px solid #facc15",
  },

  employeeMiniPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  employeePhotoPreviewBox: {
    display: "flex",
    justifyContent: "center",
  },

  employeePhotoPreview: {
    width: "92px",
    height: "92px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #facc15",
  },

  empName: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#061a44",
    margin: "0 0 6px 0",
  },

  jobTitle: {
    color: "#0284c7",
    fontWeight: "bold",
    fontSize: "14px",
    margin: "4px 0",
  },

  empContact: {
    fontSize: "13px",
    color: "#475569",
    margin: "2px 0",
  },

  empActions: {
    display: "flex",
    gap: "8px",
  },

  propertyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "16px",
  },

  filterBar: {
    maxWidth: "1180px",
    margin: "0 auto 28px",
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  filterButton: {
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#334155",
    borderRadius: "999px",
    padding: "10px 16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15,23,42,.04)",
  },

  filterButtonActive: {
    background: "#061a44",
    color: "#facc15",
    borderColor: "#061a44",
  },

  emptyState: {
    maxWidth: "620px",
    margin: "24px auto 0",
    padding: "18px",
    borderRadius: "16px",
    background: "white",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    textAlign: "center",
    fontWeight: "800",
  },

  externalSection: {
    order: 6,
    background: "#f8fafc",
    padding: "64px 24px",
    scrollMarginTop: "120px",
  },

  externalGrid: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "16px",
  },

  externalCard: {
    background: "white",
    borderRadius: "14px",
    padding: "16px",
    boxShadow: "0 8px 20px rgba(15,23,42,.045)",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    scrollMarginTop: "120px",
  },

  externalCardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "14px",
  },

  externalTag: {
    background: "#111827",
    color: "#facc15",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "900",
  },

  externalDate: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "800",
  },

  propertyCard: {
    background: "white",
    borderRadius: "14px",
    overflow: "hidden",
    boxShadow: "0 8px 20px rgba(15,23,42,.045)",
    border: "1px solid #e2e8f0",
    transition: "transform 0.3s ease",
    scrollMarginTop: "120px",
  },

  propertyImageWrapper: {
    position: "relative",
  },

  propertyImage: {
    width: "100%",
    height: "132px",
    background: "linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%)",
    display: "grid",
    placeItems: "center",
    fontSize: "34px",
    overflow: "hidden",
  },

  propertyUploadedImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  badgeLabel: {
    position: "absolute",
    top: "12px",
    right: "12px",
    background: "#ef4444",
    color: "white",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
  },

  sourceLabel: {
    position: "absolute",
    bottom: "12px",
    right: "12px",
    background: "#111827",
    color: "#facc15",
    padding: "7px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "900",
    border: "1px solid rgba(250,204,21,.5)",
  },

  propertyBody: {
    padding: "14px",
  },

  propertyLine: {
    margin: "4px 0",
    fontSize: "13px",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    lineHeight: "1.55",
    overflowWrap: "anywhere",
  },

  propertyLineIcon: {
    width: "18px",
    minWidth: "18px",
    display: "inline-grid",
    placeItems: "center",
    fontSize: "14px",
    lineHeight: 1,
  },

  propertyNote: {
    fontSize: "12px",
    color: "#0b4aa2",
    fontStyle: "italic",
    background: "#f0f9ff",
    padding: "8px 10px",
    borderRadius: "9px",
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    lineHeight: "1.65",
    overflowWrap: "anywhere",
  },

  propertyNoteIcon: {
    width: "20px",
    minWidth: "20px",
    display: "inline-grid",
    placeItems: "center",
    fontSize: "15px",
    lineHeight: 1.2,
  },

  sourceNotice: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "12px",
    lineHeight: "1.7",
    color: "#475569",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    padding: "10px",
    borderRadius: "10px",
    marginTop: "10px",
    overflowWrap: "anywhere",
  },

  sourceLink: {
    color: "#0b4aa2",
    fontWeight: "900",
    textDecoration: "none",
  },

  propertyButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
    gap: "8px",
    marginTop: "12px",
    width: "100%",
    boxSizing: "border-box",
  },

  cardActionButton: {
    width: "auto",
    maxWidth: "100%",
    minHeight: "40px",
    padding: "9px 10px",
    borderRadius: "10px",
    boxSizing: "border-box",
    textAlign: "center",
    lineHeight: "1.4",
    fontSize: "12px",
  },

  darkSection: {
    order: 10,
    background: "linear-gradient(135deg, #061a44 0%, #0b4aa2 100%)",
    color: "white",
    padding: "64px 24px",
    scrollMarginTop: "120px",
  },

  inner: {
    maxWidth: "1180px",
    margin: "0 auto",
  },

  sectionHeadLight: {
    textAlign: "center",
    marginBottom: "48px",
  },

  goldLabel: {
    color: "#facc15",
    fontWeight: "900",
    fontSize: "14px",
  },

  darkTitle: {
    fontSize: "clamp(28px, 4vw, 48px)",
    fontWeight: "900",
    marginBottom: "16px",
    color: "white",
  },

  darkText: {
    fontSize: "16px",
    color: "#e0f2fe",
    maxWidth: "500px",
    margin: "0 auto",
    lineHeight: "1.6",
  },

  teamGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "24px",
  },

  teamCard: {
    background: "rgba(255,255,255,0.10)",
    padding: "28px 24px",
    borderRadius: "16px",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.18)",
    backdropFilter: "blur(8px)",
    overflow: "hidden",
  },

  teamPhotoBox: {
    width: "92px",
    height: "92px",
    margin: "0 auto 16px",
    borderRadius: "50%",
    overflow: "hidden",
    background: "rgba(255,255,255,0.15)",
    border: "3px solid #facc15",
    display: "grid",
    placeItems: "center",
  },

  teamPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center top",
    display: "block",
  },

  teamFallbackIcon: {
    fontSize: "34px",
  },

  job: {
    color: "#facc15",
    fontWeight: "900",
    fontSize: "13px",
    marginBottom: "8px",
  },

  name: {
    fontSize: "18px",
    fontWeight: "900",
    marginBottom: "8px",
  },

  phone: {
    color: "#dbeafe",
    fontSize: "14px",
    marginBottom: "16px",
  },

  facebookPromoCta: {
    display: "none",
    maxWidth: "1180px",
    margin: "64px auto",
    padding: "48px",
    background: "linear-gradient(135deg, #1f2937 0%, #374151 100%)",
    borderRadius: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "32px",
    color: "white",
    flexWrap: "wrap",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  facebookPromoTitle: {
    fontSize: "28px",
    fontWeight: "900",
    marginBottom: "12px",
  },

  facebookPromoText: {
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#e5e7eb",
  },

  facebookPromoButton: {
    background: "#3b82f6",
    color: "white",
    padding: "16px 32px",
    borderRadius: "16px",
    textDecoration: "none",
    fontWeight: "900",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    maxWidth: "100%",
    textAlign: "center",
    lineHeight: "1.5",
  },

  promo: {
    order: 11,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "48px",
    alignItems: "center",
  },

  promoTitle: {
    fontSize: "clamp(24px, 4vw, 40px)",
    fontWeight: "900",
    marginBottom: "16px",
    color: "#061a44",
  },

  promoText: {
    fontSize: "16px",
    lineHeight: "1.8",
    color: "#475569",
    marginBottom: "24px",
  },

  infoBox: {
    background: "#f8fafc",
    padding: "20px",
    borderRadius: "12px",
    marginBottom: "24px",
  },

  infoLine: {
    fontSize: "13px",
    color: "#475569",
    marginBottom: "8px",
    lineHeight: "1.6",
  },

  qrBox: {
    textAlign: "center",
    padding: "32px",
    background: "#f8fafc",
    borderRadius: "20px",
    border: "2px dashed #cbd5e1",
  },

  qr: {
    width: "240px",
    height: "240px",
    borderRadius: "12px",
    marginBottom: "16px",
  },

  qrTitle: {
    fontSize: "18px",
    fontWeight: "900",
    marginBottom: "8px",
    color: "#061a44",
  },

  qrText: {
    fontSize: "14px",
    color: "#475569",
  },

  footer: {
    order: 12,
    background: "#1e293b",
    color: "white",
    padding: "64px 24px",
    textAlign: "center",
    scrollMarginTop: "120px",
  },

  footerTitle: {
    fontSize: "28px",
    fontWeight: "900",
    marginBottom: "12px",
    color: "#facc15",
  },

  footerText: {
    fontSize: "16px",
    color: "#cbd5e1",
    marginBottom: "32px",
    lineHeight: "1.6",
  },

  footerContacts: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "32px",
  },

  footerLink: {
    color: "#dbeafe",
    textDecoration: "none",
    fontSize: "14px",
  },

  copy: {
    color: "#94a3b8",
    fontSize: "13px",
    marginTop: "24px",
  },

  floating: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    left: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    zIndex: 99,
  },

  floatMap: {
    width: "54px",
    height: "54px",
    background: "#2563eb",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "white",
    textDecoration: "none",
    boxShadow: "0 4px 16px rgba(37,99,235,.4)",
  },

  floatWhats: {
    width: "54px",
    height: "54px",
    background: "#059669",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "white",
    textDecoration: "none",
    boxShadow: "0 4px 16px rgba(5,150,105,.4)",
  },

  loadingBanner: {
    background: "#0ea5e9",
    color: "white",
    padding: "12px 24px",
    textAlign: "center",
    fontWeight: "900",
  },

  errorBanner: {
    background: "#ef4444",
    color: "white",
    padding: "12px 24px",
    textAlign: "center",
    fontWeight: "900",
  },

};

function createResponsiveStyles(base, viewportWidth) {
  const isTablet = viewportWidth <= 960;
  const isMobile = viewportWidth <= 680;

  if (!isTablet) return base;

  const tablet = {
    hero: {
      ...base.hero,
      padding: "18px",
    },
    nav: {
      ...base.nav,
      margin: "0 auto 18px",
      padding: "12px",
      borderRadius: "18px",
      gap: "14px",
      position: "relative",
      top: "auto",
    },
    navLinks: {
      ...base.navLinks,
      width: "100%",
      justifyContent: "center",
      gap: "8px",
    },
    navLink: {
      ...base.navLink,
      padding: "9px 11px",
      borderRadius: "12px",
      fontSize: "13px",
      whiteSpace: "nowrap",
    },
    logo: {
      ...base.logo,
      fontSize: "22px",
    },
    title: {
      ...base.title,
      fontSize: "clamp(30px, 7vw, 48px)",
      lineHeight: "1.35",
    },
    description: {
      ...base.description,
      fontSize: "17px",
      lineHeight: "1.85",
    },
    bannerBox: {
      ...base.bannerBox,
      borderRadius: "20px",
    },
    banner: {
      ...base.banner,
      height: "auto",
      maxHeight: "520px",
    },
    section: {
      ...base.section,
      padding: "52px 18px",
      scrollMarginTop: "24px",
    },
    externalSection: {
      ...base.externalSection,
      padding: "52px 18px",
      scrollMarginTop: "24px",
    },
    darkSection: {
      ...base.darkSection,
      padding: "52px 18px",
      scrollMarginTop: "24px",
    },
    trustStrip: {
      ...base.trustStrip,
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      margin: "-18px auto 28px",
      padding: "0 18px",
    },
    liveTicker: {
      ...base.liveTicker,
      gridTemplateColumns: "1fr",
      padding: "0 18px",
    },
    assuranceSection: {
      ...base.assuranceSection,
      padding: "0 18px",
    },
    assuranceGrid: {
      ...base.assuranceGrid,
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    adminDashboard: {
      ...base.adminDashboard,
      margin: "28px 16px",
      padding: "22px",
    },
    dashboardHeader: {
      ...base.dashboardHeader,
      alignItems: "flex-start",
      gap: "14px",
      flexWrap: "wrap",
    },
  };

  if (!isMobile) return { ...base, ...tablet };

  return {
    ...base,
    ...tablet,
    userBanner: {
      ...base.userBanner,
      padding: "10px 14px",
      fontSize: "12px",
      gap: "10px",
    },
    logoutQuickBtn: {
      ...base.logoutQuickBtn,
      padding: "6px 10px",
      borderRadius: "10px",
    },
    hero: {
      ...tablet.hero,
      padding: "12px",
    },
    nav: {
      ...tablet.nav,
      marginBottom: "14px",
      padding: "10px",
      borderRadius: "16px",
      justifyContent: "center",
    },
    logoBox: {
      ...base.logoBox,
      width: "100%",
      justifyContent: "center",
      textAlign: "center",
      gap: "8px",
    },
    logoIcon: {
      ...base.logoIcon,
      width: "38px",
      height: "38px",
      borderRadius: "12px",
      fontSize: "18px",
      flex: "0 0 auto",
    },
    logo: {
      ...base.logo,
      fontSize: "16px",
      lineHeight: "1.45",
    },
    subtitle: {
      ...base.subtitle,
      fontSize: "11px",
      lineHeight: "1.5",
    },
    navLinks: {
      ...tablet.navLinks,
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "7px",
    },
    navLink: {
      ...tablet.navLink,
      padding: "8px 5px",
      fontSize: "11px",
      borderRadius: "10px",
      textAlign: "center",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    adminSecretBtn: {
      ...base.adminSecretBtn,
      width: "34px",
      height: "34px",
      fontSize: "14px",
      justifySelf: "center",
    },
    dhikrBar: {
      ...base.dhikrBar,
      margin: "0 auto 12px",
      padding: "9px 10px",
      borderRadius: "14px",
      gap: "8px",
      flexDirection: "column",
      maxWidth: "100%",
    },
    dhikrLabel: {
      ...base.dhikrLabel,
      fontSize: "11px",
      padding: "3px 9px",
    },
    dhikrText: {
      ...base.dhikrText,
      fontSize: "13px",
      lineHeight: "1.8",
    },
    loginPanel: {
      ...base.loginPanel,
      left: "12px",
      right: "12px",
      width: "auto",
      top: "96px",
      padding: "16px",
    },
    loginPanelButtons: {
      ...base.loginPanelButtons,
      gridTemplateColumns: "1fr",
    },
    bannerBox: {
      ...tablet.bannerBox,
      borderRadius: "16px",
      boxShadow: "0 16px 40px rgba(0,0,0,.24)",
    },
    banner: {
      ...tablet.banner,
      maxHeight: "300px",
      objectFit: "contain",
    },
    heroContent: {
      ...base.heroContent,
      margin: "24px auto 28px",
      padding: "0 4px",
    },
    badge: {
      ...base.badge,
      padding: "8px 12px",
      fontSize: "12px",
      lineHeight: "1.7",
      borderRadius: "18px",
    },
    title: {
      ...tablet.title,
      maxWidth: "100%",
      fontSize: "28px",
      lineHeight: "1.45",
      margin: "14px auto 10px",
    },
    description: {
      ...tablet.description,
      fontSize: "14px",
      lineHeight: "1.9",
    },
    buttons: {
      ...base.buttons,
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "10px",
      marginTop: "18px",
    },
    buttonsCenter: {
      ...base.buttonsCenter,
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "10px",
    },
    whatsapp: {
      ...base.whatsapp,
      width: "100%",
      padding: "12px 14px",
      borderRadius: "12px",
      textAlign: "center",
      fontSize: "14px",
      lineHeight: "1.5",
    },
    call: {
      ...base.call,
      width: "100%",
      padding: "12px 14px",
      borderRadius: "12px",
      textAlign: "center",
      fontSize: "14px",
      lineHeight: "1.5",
    },
    map: {
      ...base.map,
      width: "100%",
      padding: "12px 14px",
      borderRadius: "12px",
      textAlign: "center",
      fontSize: "14px",
      lineHeight: "1.5",
    },
    cardShareButton: {
      ...base.cardShareButton,
      width: "100%",
      padding: "12px 14px",
      borderRadius: "12px",
      textAlign: "center",
      fontSize: "14px",
      lineHeight: "1.5",
    },
    section: {
      ...tablet.section,
      padding: "40px 14px",
    },
    trustStrip: {
      ...tablet.trustStrip,
      gridTemplateColumns: "1fr 1fr",
      gap: "10px",
      padding: "0 14px",
      margin: "-12px auto 24px",
    },
    trustMetric: {
      ...base.trustMetric,
      padding: "14px 10px",
      borderRadius: "14px",
    },
    trustMetricIcon: {
      ...base.trustMetricIcon,
      width: "34px",
      height: "34px",
      borderRadius: "12px",
    },
    trustMetricValue: {
      ...base.trustMetricValue,
      fontSize: "14px",
      lineHeight: "1.5",
    },
    trustMetricLabel: {
      ...base.trustMetricLabel,
      fontSize: "11px",
    },
    liveTicker: {
      ...tablet.liveTicker,
      padding: "0 14px",
      marginBottom: "14px",
      gap: "8px",
    },
    liveTickerHead: {
      ...base.liveTickerHead,
      padding: "9px 12px",
      fontSize: "13px",
    },
    liveTickerSpotlight: {
      ...base.liveTickerSpotlight,
      padding: "8px 10px",
      gap: "7px",
      fontSize: "11px",
      justifyContent: "center",
    },
    liveTickerLocation: {
      ...base.liveTickerLocation,
      maxWidth: "34%",
    },
    quickServices: {
      ...base.quickServices,
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "8px",
      padding: "0 14px",
      marginBottom: "18px",
    },
    quickServiceItem: {
      ...base.quickServiceItem,
      padding: "10px 6px",
      borderRadius: "13px",
      fontSize: "11px",
      gap: "6px",
    },
    quickServiceIcon: {
      ...base.quickServiceIcon,
      width: "30px",
      height: "30px",
      borderRadius: "11px",
    },
    assuranceSection: {
      ...tablet.assuranceSection,
      padding: "0 14px",
      marginBottom: "32px",
    },
    assuranceHeader: {
      ...base.assuranceHeader,
      alignItems: "flex-start",
      flexDirection: "column",
      marginBottom: "12px",
    },
    assuranceMainTitle: {
      ...base.assuranceMainTitle,
      fontSize: "20px",
    },
    assuranceGrid: {
      ...tablet.assuranceGrid,
      gridTemplateColumns: "1fr",
      gap: "10px",
    },
    assuranceItem: {
      ...base.assuranceItem,
      padding: "12px",
      borderRadius: "12px",
    },
    externalSection: {
      ...tablet.externalSection,
      padding: "40px 14px",
    },
    darkSection: {
      ...tablet.darkSection,
      padding: "42px 14px",
    },
    sectionHead: {
      ...base.sectionHead,
      marginBottom: "22px",
    },
    sectionHeadLight: {
      ...base.sectionHeadLight,
      marginBottom: "28px",
    },
    sectionTitle: {
      ...base.sectionTitle,
      fontSize: "28px",
      lineHeight: "1.35",
      marginBottom: "10px",
    },
    darkTitle: {
      ...base.darkTitle,
      fontSize: "28px",
      lineHeight: "1.35",
      marginBottom: "10px",
    },
    sectionText: {
      ...base.sectionText,
      fontSize: "14px",
      lineHeight: "1.8",
    },
    darkText: {
      ...base.darkText,
      fontSize: "14px",
      lineHeight: "1.8",
    },
    grid4: {
      ...base.grid4,
      gridTemplateColumns: "1fr",
      gap: "10px",
    },
    card: {
      ...base.card,
      padding: "15px",
      borderRadius: "14px",
      minHeight: "auto",
      gridTemplateColumns: "40px minmax(0, 1fr)",
      gap: "12px",
    },
    iconBox: {
      ...base.iconBox,
      width: "40px",
      height: "40px",
      borderRadius: "12px",
      fontSize: "18px",
    },
    cardTitle: {
      ...base.cardTitle,
      fontSize: "15px",
      lineHeight: "1.45",
    },
    cardText: {
      ...base.cardText,
      fontSize: "13px",
      lineHeight: "1.85",
    },
    requestSection: {
      ...base.requestSection,
      margin: "0 14px 40px",
      padding: "24px 16px",
      borderRadius: "18px",
      gridTemplateColumns: "1fr",
      gap: "18px",
      scrollMarginTop: "24px",
    },
    requestSectionCompact: {
      ...base.requestSectionCompact,
      padding: "24px 16px",
      gridTemplateColumns: "1fr",
    },
    requestIntro: {
      ...base.requestIntro,
      textAlign: "center",
    },
    requestTitle: {
      ...base.requestTitle,
      fontSize: "27px",
      lineHeight: "1.4",
    },
    requestText: {
      ...base.requestText,
      fontSize: "14px",
      lineHeight: "1.8",
    },
    requestToggleButton: {
      ...base.requestToggleButton,
      width: "100%",
      padding: "12px 14px",
      borderRadius: "12px",
    },
    requestForm: {
      ...base.requestForm,
      padding: "16px",
      borderRadius: "14px",
    },
    requestFileBox: {
      ...base.requestFileBox,
      flexDirection: "column",
      alignItems: "stretch",
      gap: "8px",
    },
    requestButton: {
      ...base.requestButton,
      width: "100%",
      padding: "13px 14px",
      fontSize: "14px",
    },
    facebookCta: {
      ...base.facebookCta,
      margin: "0 14px 40px",
      padding: "24px 18px",
      borderRadius: "18px",
      flexDirection: "column",
      alignItems: "stretch",
      textAlign: "center",
      maxWidth: "calc(100% - 28px)",
      width: "auto",
    },
    facebookContent: {
      ...base.facebookContent,
      width: "100%",
      flex: "0 1 auto",
      minWidth: 0,
    },
    facebookTitle: {
      ...base.facebookTitle,
      fontSize: "22px",
      lineHeight: "1.45",
    },
    facebookButton: {
      ...base.facebookButton,
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      padding: "13px 18px",
      textAlign: "center",
    },
    propertyGrid: {
      ...base.propertyGrid,
      gridTemplateColumns: "1fr",
      gap: "16px",
    },
    filterBar: {
      ...base.filterBar,
      justifyContent: "flex-start",
      flexWrap: "nowrap",
      overflowX: "auto",
      paddingBottom: "4px",
      marginBottom: "20px",
      maxWidth: "100%",
    },
    filterButton: {
      ...base.filterButton,
      flex: "0 0 auto",
      padding: "9px 12px",
      fontSize: "12px",
    },
    externalGrid: {
      ...base.externalGrid,
      gridTemplateColumns: "1fr",
      gap: "16px",
    },
    externalCard: {
      ...base.externalCard,
      padding: "18px",
      borderRadius: "14px",
    },
    externalCardHead: {
      ...base.externalCardHead,
      alignItems: "flex-start",
      flexDirection: "column",
    },
    propertyImage: {
      ...base.propertyImage,
      height: "116px",
      fontSize: "24px",
    },
    propertyLine: {
      ...base.propertyLine,
      fontSize: "13px",
      gap: "7px",
      lineHeight: "1.8",
    },
    propertyLineIcon: {
      ...base.propertyLineIcon,
      width: "18px",
      minWidth: "18px",
      fontSize: "14px",
    },
    propertyBody: {
      ...base.propertyBody,
      padding: "16px",
    },
    propertyNote: {
      ...base.propertyNote,
      fontSize: "13px",
      padding: "10px 12px",
      gap: "6px",
    },
    propertyNoteIcon: {
      ...base.propertyNoteIcon,
      width: "18px",
      minWidth: "18px",
      fontSize: "13px",
    },
    propertyButtons: {
      ...base.propertyButtons,
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "10px",
      alignItems: "stretch",
      paddingInline: "0",
    },
    cardActionButton: {
      ...base.cardActionButton,
      width: "100%",
      maxWidth: "100%",
      minHeight: "46px",
      padding: "11px 12px",
      borderRadius: "12px",
      fontSize: "14px",
    },
    badgeLabel: {
      ...base.badgeLabel,
      fontSize: "11px",
      padding: "6px 10px",
    },
    sourceLabel: {
      ...base.sourceLabel,
      fontSize: "11px",
      padding: "6px 10px",
    },
    teamGrid: {
      ...base.teamGrid,
      gridTemplateColumns: "1fr",
      gap: "16px",
    },
    teamCard: {
      ...base.teamCard,
      padding: "22px 18px",
      borderRadius: "14px",
    },
    teamPhotoBox: {
      ...base.teamPhotoBox,
      width: "78px",
      height: "78px",
    },
    teamFallbackIcon: {
      ...base.teamFallbackIcon,
      fontSize: "22px",
    },
    facebookPromoCta: {
      ...base.facebookPromoCta,
      margin: "40px 0",
      padding: "24px 18px",
      borderRadius: "18px",
      flexDirection: "column",
      alignItems: "stretch",
      textAlign: "center",
      maxWidth: "100%",
      width: "100%",
    },
    facebookPromoTitle: {
      ...base.facebookPromoTitle,
      fontSize: "22px",
      lineHeight: "1.45",
    },
    facebookPromoButton: {
      ...base.facebookPromoButton,
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      padding: "13px 18px",
      textAlign: "center",
    },
    promo: {
      ...base.promo,
      gridTemplateColumns: "1fr",
      gap: "24px",
    },
    promoTitle: {
      ...base.promoTitle,
      fontSize: "25px",
      lineHeight: "1.4",
    },
    infoBox: {
      ...base.infoBox,
      padding: "16px",
    },
    qrBox: {
      ...base.qrBox,
      padding: "20px 14px",
    },
    qr: {
      ...base.qr,
      width: "200px",
      height: "200px",
    },
    footer: {
      ...base.footer,
      padding: "44px 14px",
    },
    footerTitle: {
      ...base.footerTitle,
      fontSize: "24px",
      lineHeight: "1.45",
    },
    floating: {
      ...base.floating,
      right: "calc(env(safe-area-inset-right, 0px) + 12px)",
      left: "auto",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
      gap: "9px",
      zIndex: 40,
    },
    floatMap: {
      ...base.floatMap,
      width: "40px",
      height: "40px",
      boxShadow: "0 8px 22px rgba(37,99,235,.28)",
    },
    floatWhats: {
      ...base.floatWhats,
      width: "40px",
      height: "40px",
      boxShadow: "0 8px 22px rgba(5,150,105,.28)",
    },
    adminDashboard: {
      ...tablet.adminDashboard,
      margin: "18px 10px",
      padding: "16px",
      borderRadius: "18px",
    },
    dashboardTitle: {
      ...base.dashboardTitle,
      fontSize: "22px",
      lineHeight: "1.4",
    },
    tabs: {
      ...base.tabs,
      flexWrap: "nowrap",
      overflowX: "auto",
      paddingBottom: "10px",
    },
    tabBtn: {
      ...base.tabBtn,
      flex: "0 0 auto",
      padding: "9px 12px",
      fontSize: "12px",
    },
    form: {
      ...base.form,
      padding: "16px",
      borderRadius: "14px",
    },
    formRow: {
      ...base.formRow,
      gridTemplateColumns: "1fr",
      gap: "12px",
    },
    input: {
      ...base.input,
      fontSize: "16px",
    },
    textarea: {
      ...base.textarea,
      fontSize: "16px",
    },
    fileInputWrapper: {
      ...base.fileInputWrapper,
      alignItems: "stretch",
      flexDirection: "column",
    },
    fileInput: {
      ...base.fileInput,
      width: "100%",
    },
    addButton: {
      ...base.addButton,
      width: "100%",
      padding: "13px 16px",
    },
    cancelButton: {
      ...base.cancelButton,
      width: "100%",
      padding: "13px 16px",
    },
    propertyListItem: {
      ...base.propertyListItem,
      alignItems: "stretch",
      gap: "14px",
    },
    propActions: {
      ...base.propActions,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
    },
    employeeCard: {
      ...base.employeeCard,
      alignItems: "stretch",
    },
    employeeCardInfo: {
      ...base.employeeCardInfo,
      alignItems: "center",
    },
    empActions: {
      ...base.empActions,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
    },
    loadingBanner: {
      ...base.loadingBanner,
      padding: "10px 12px",
      fontSize: "13px",
      lineHeight: "1.6",
    },
    errorBanner: {
      ...base.errorBanner,
      padding: "10px 12px",
      fontSize: "13px",
      lineHeight: "1.6",
    },
  };
}
