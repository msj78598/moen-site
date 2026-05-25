import { useEffect, useState } from "react";

export default function App() {
  const banner = "/9c049017-4f6a-4029-9071-700b2fdf099a.png";

  const OWNER_PASSWORD = "Zzz2024";
  const EMPLOYEE_PASSWORD = "Zzz2024";

  const PERMISSIONS = {
    owner: [
      "add",
      "edit",
      "delete",
      "upload",
      "manage_team",
      "edit_contact",
      "view_dashboard",
    ],
    employee: ["add", "upload", "view_dashboard", "share"],
  };

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
      photo: "",
    },
    {
      id: 3,
      name: "زيد عبابنه",
      title: "مدير علاقات خارجية",
      phone: "00962797022220",
      whatsapp: "https://wa.me/962797022220",
      email: "external@ababneh.jo",
      photo: "",
    },
  ];

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
  };

  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState(defaultProperties);
  const [team, setTeam] = useState(defaultTeam);
  const [contactData, setContactData] = useState(defaultContact);

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
  });

  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    title: "",
    phone: "",
    email: "",
    whatsapp: "",
    photo: "",
  });

  useEffect(() => {
    const savedProps = localStorage.getItem("diftain_properties");
    const savedTeam = localStorage.getItem("diftain_team");
    const savedContact = localStorage.getItem("diftain_contact");

    if (savedProps) setProperties(JSON.parse(savedProps));
    if (savedTeam) setTeam(JSON.parse(savedTeam));
    if (savedContact) setContactData(JSON.parse(savedContact));
  }, []);

  function saveProperties(nextProperties) {
    setProperties(nextProperties);
    localStorage.setItem("diftain_properties", JSON.stringify(nextProperties));
  }

  function saveTeam(nextTeam) {
    setTeam(nextTeam);
    localStorage.setItem("diftain_team", JSON.stringify(nextTeam));
  }

  function saveContact(nextContact) {
    setContactData(nextContact);
    localStorage.setItem("diftain_contact", JSON.stringify(nextContact));
  }

  function can(permission) {
    if (!user) return false;
    return PERMISSIONS[user.role]?.includes(permission);
  }

  function login(role) {
    const password = prompt(
      `أدخل كلمة مرور ${role === "owner" ? "المالك" : "الموظف"}:`
    );

    const correctPassword =
      role === "owner" ? OWNER_PASSWORD : EMPLOYEE_PASSWORD;

    if (password === correctPassword) {
      setUser({
        role,
        name: role === "owner" ? "المالك" : "موظف",
      });
      setShowAdminDash(true);
      alert(`تم الدخول كـ ${role === "owner" ? "مالك" : "موظف"}`);
    } else {
      alert("كلمة المرور غير صحيحة");
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

  function logout() {
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
    });
    setEditingProperty(null);
  }

  function saveProperty(e) {
    e.preventDefault();

    if (!can("add") && !can("edit")) {
      alert("ليس لديك صلاحية لإدارة العروض");
      return;
    }

    if (!form.type || !form.location || !form.size || !form.price) {
      alert("يرجى تعبئة نوع العقار والموقع والمساحة والسعر");
      return;
    }

    const phone = form.phone || contactData.phone;

    if (editingProperty) {
      if (!can("edit")) {
        alert("ليس لديك صلاحية تعديل العروض");
        return;
      }

      const updatedProps = properties.map((p) =>
        p.id === editingProperty.id
          ? {
              ...p,
              ...form,
              phone,
              updatedBy: user.name,
            }
          : p
      );

      saveProperties(updatedProps);
    } else {
      if (!can("add")) {
        alert("ليس لديك صلاحية إضافة العروض");
        return;
      }

      const newProperty = {
        id: Date.now(),
        ...form,
        phone,
        createdBy: user.name,
      };

      saveProperties([newProperty, ...properties]);
    }

    resetPropertyForm();
  }

  function deleteProperty(id) {
    if (!can("delete")) {
      alert("ليس لديك صلاحية حذف العروض");
      return;
    }

    if (!window.confirm("هل تريد حذف هذا العرض؟")) return;
    saveProperties(properties.filter((p) => p.id !== id));
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
    });
    setActiveTab("properties");
    setShowAdminDash(true);
    window.location.hash = "#admin";
  }

  function saveEmployee(e) {
    e.preventDefault();

    if (!can("manage_team")) {
      alert("ليس لديك صلاحية إدارة الموظفين");
      return;
    }

    if (!employeeForm.name || !employeeForm.title || !employeeForm.phone) {
      alert("يرجى تعبئة اسم الموظف والمسمى ورقم الهاتف");
      return;
    }

    if (editingEmployee) {
      const updatedTeam = team.map((emp) =>
        emp.id === editingEmployee.id ? { ...emp, ...employeeForm } : emp
      );
      saveTeam(updatedTeam);
      setEditingEmployee(null);
    } else {
      const newEmployee = {
        id: Date.now(),
        ...employeeForm,
      };
      saveTeam([...team, newEmployee]);
    }

    setEmployeeForm({
      name: "",
      title: "",
      phone: "",
      email: "",
      whatsapp: "",
      photo: "",
    });
  }

  function deleteEmployee(id) {
    if (!can("manage_team")) {
      alert("ليس لديك صلاحية حذف الموظفين");
      return;
    }

    if (!window.confirm("هل تريد حذف هذا الموظف؟")) return;
    saveTeam(team.filter((emp) => emp.id !== id));
  }

  function handlePropertyImageUpload(e) {
    if (!can("upload")) {
      alert("ليس لديك صلاحية رفع الصور");
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setForm({
        ...form,
        image: reader.result,
      });
    };

    reader.readAsDataURL(file);
  }

  function handleEmployeePhotoUpload(e) {
    if (!can("manage_team")) {
      alert("ليس لديك صلاحية إدارة الموظفين");
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setEmployeeForm({
        ...employeeForm,
        photo: reader.result,
      });
    };

    reader.readAsDataURL(file);
  }

  function normalPhone(phone) {
    return (phone || "")
      .replace(/^00962/, "962")
      .replace(/^0/, "962")
      .replace(/\D/g, "");
  }

  function shareProperty(property) {
    const phone = normalPhone(property.phone || contactData.phone);

    const text = `🏠 عرض عقاري من مكتب الضفتين العقاري

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
    const text = `عرض عقاري من مكتب الضفتين العقاري
نوع العقار: ${property.type}
الموقع: ${property.location}
المساحة: ${property.size}
السعر: ${property.price}
${property.note || ""}`;

    navigator.clipboard.writeText(text);
    alert("تم نسخ تفاصيل العرض");
  }

  const qrLink =
    typeof window !== "undefined" ? window.location.origin + "/#promo" : "";

  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=270x270&data=${encodeURIComponent(
    qrLink
  )}`;

  return (
    <main dir="rtl" style={styles.page}>
      {user && (
        <div style={styles.userBanner}>
          <span>
            ✅ مرحبًا {user.name} - دخول{" "}
            {user.role === "owner" ? "مالك" : "موظف"}
          </span>
          <button style={styles.logoutQuickBtn} onClick={logout}>
            خروج
          </button>
        </div>
      )}

      <header id="home" style={styles.hero}>
        <nav style={styles.nav}>
          <a href="#home" style={styles.logoBox}>
            <span style={styles.logoIcon}>🏛️</span>
            <span>
              <strong style={styles.logo}>مكتب الضفتين العقاري</strong>
              <small style={styles.subtitle}>بيع وشراء الأراضي والعقارات</small>
            </span>
          </a>

          <div style={styles.navLinks}>
            <a style={styles.navLink} href="#home">
              الرئيسية
            </a>
            <a style={styles.navLink} href="#services">
              الخدمات
            </a>
            <a style={styles.navLink} href="#properties">
              العروض
            </a>
            <a style={styles.navLink} href="#team">
              فريق العمل
            </a>
            <a style={styles.navLink} href="#promo">
              الباركود
            </a>
            <a style={styles.navLink} href="#contact">
              تواصل معنا
            </a>
            <button
              style={styles.adminSecretBtn}
              onClick={adminLoginClick}
              title="دخول الإدارة"
            >
              ⚙️
            </button>
          </div>
        </nav>
        {showLoginPanel && !user && (
  <div style={styles.loginPanel}>
    <div style={styles.loginPanelHeader}>
      <strong>دخول الإدارة</strong>
      <button
        style={styles.loginPanelClose}
        onClick={() => setShowLoginPanel(false)}
      >
        ✕
      </button>
    </div>

    <p style={styles.loginPanelText}>
      اختر نوع الدخول ثم أدخل كلمة المرور.
    </p>

    <div style={styles.loginPanelButtons}>
      <button
        style={styles.ownerLoginChoice}
        onClick={() => {
          setShowLoginPanel(false);
          login("owner");
        }}
      >
        👑 دخول المالك
      </button>

      <button
        style={styles.employeeLoginChoice}
        onClick={() => {
          setShowLoginPanel(false);
          login("employee");
        }}
      >
        👤 دخول الموظف
      </button>
    </div>
  </div>
)}

        <div style={styles.bannerBox}>
          <img src={banner} alt="مكتب الضفتين العقاري" style={styles.banner} />
        </div>

        <div style={styles.heroContent}>
          <span style={styles.badge}>
            مؤسسة تسويق عقاري بخدمة مباشرة وفريق متخصص
          </span>

          <h1 style={styles.title}>
            نسوّق عقارك باحتراف ونوصلك بالمشتري الجاد
          </h1>

          <p style={styles.description}>
            مكتب الضفتين العقاري يقدم خدمات البيع والشراء والتسويق العقاري
            للأراضي والعقارات، مع فريق إداري متخصص للتواصل السريع وخدمة العملاء.
          </p>

          <div style={styles.buttons}>
            <a
              style={styles.whatsapp}
              href={contactData.whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              واتساب المدير
            </a>
            <a style={styles.call} href={`tel:${contactData.phone}`}>
              اتصال مباشر
            </a>
            <a
              style={styles.map}
              href={contactData.maps}
              target="_blank"
              rel="noreferrer"
            >
              الخريطة
            </a>
          </div>
        </div>
      </header>

      <section id="services" style={styles.section}>
        <div style={styles.sectionHead}>
          <span style={styles.sectionLabel}>خدماتنا</span>
          <h2 style={styles.sectionTitle}>حلول عقارية متكاملة</h2>
          <p style={styles.sectionText}>
            نخدم ملاك العقارات والباحثين عن فرص مناسبة من خلال تسويق واضح
            وتواصل مباشر.
          </p>
        </div>

        <div style={styles.grid4}>
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
          ].map(([icon, title, text]) => (
            <article style={styles.card} key={title}>
              <div style={styles.iconBox}>{icon}</div>
              <h3 style={styles.cardTitle}>{title}</h3>
              <p style={styles.cardText}>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.facebookCta}>
        <div>
          <h2 style={styles.facebookTitle}>تابع أحدث العروض العقارية</h2>
          <p style={styles.facebookText}>
            تابعوا صفحة مكتب الضفتين العقاري على فيسبوك للاطلاع على أحدث
            الأراضي والعقارات المتوفرة أولًا بأول.
          </p>
        </div>

        <a
          style={styles.facebookButton}
          href={contactData.facebook}
          target="_blank"
          rel="noreferrer"
        >
          متابعة صفحة فيسبوك
        </a>
      </section>

      {user && showAdminDash && (
        <section id="admin" style={styles.adminDashboard}>
          <div style={styles.dashboardHeader}>
            <h2 style={styles.dashboardTitle}>⚙️ لوحة الإدارة</h2>
            <button
              style={styles.closeBtn}
              onClick={() => setShowAdminDash(false)}
            >
              ✕
            </button>
          </div>

          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tabBtn,
                ...(activeTab === "properties" ? styles.tabBtnActive : {}),
              }}
              onClick={() => setActiveTab("properties")}
            >
              📋 العروض
            </button>

            {can("manage_team") && (
              <button
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === "team" ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab("team")}
              >
                👥 الموظفون
              </button>
            )}

            {can("edit_contact") && (
              <button
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === "contact" ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab("contact")}
              >
                📞 التواصل
              </button>
            )}
          </div>

          {activeTab === "properties" && (
            <div style={styles.tabContent}>
              <h3 style={styles.tabTitle}>إدارة العروض العقارية</h3>

              <form style={styles.form} onSubmit={saveProperty}>
                <div style={styles.formRow}>
                  <input
                    style={styles.input}
                    placeholder="نوع العقار"
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value })
                    }
                  />

                  <input
                    style={styles.input}
                    placeholder="الموقع"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                  />
                </div>

                <div style={styles.formRow}>
                  <input
                    style={styles.input}
                    placeholder="المساحة"
                    value={form.size}
                    onChange={(e) =>
                      setForm({ ...form, size: e.target.value })
                    }
                  />

                  <input
                    style={styles.input}
                    placeholder="السعر"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                  />
                </div>

                <div style={styles.formRow}>
                  <input
                    style={styles.input}
                    placeholder="رقم التواصل"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />

                  <select
                    style={styles.input}
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
                  style={styles.textarea}
                  placeholder="ملاحظات إضافية"
                  value={form.note}
                  onChange={(e) =>
                    setForm({ ...form, note: e.target.value })
                  }
                />

                <div style={styles.fileInputWrapper}>
                  <label style={styles.fileLabel}>📸 صورة العقار:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePropertyImageUpload}
                    style={styles.fileInput}
                  />
                </div>

                <div style={styles.formRow}>
                  <button style={styles.addButton} type="submit">
                    {editingProperty ? "حفظ التعديل" : "إضافة عرض"}
                  </button>

                  {editingProperty && (
                    <button
                      style={styles.cancelButton}
                      type="button"
                      onClick={resetPropertyForm}
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>

              <div style={styles.propertyList}>
                <h3 style={styles.listTitle}>
                  قائمة العروض ({properties.length})
                </h3>

                {properties.map((prop) => (
                  <div key={prop.id} style={styles.propertyListItem}>
                    <div>
                      <strong style={styles.propTitle}>
                        {prop.badge !== "عادي" ? `${prop.badge} • ` : ""}
                        {prop.type}
                      </strong>
                      <p style={styles.propInfo}>الموقع: {prop.location}</p>
                      <p style={styles.propInfo}>المساحة: {prop.size}</p>
                      <p style={styles.propInfo}>السعر: {prop.price}</p>
                      <small style={styles.propMeta}>
                        أضيف بواسطة: {prop.createdBy}
                      </small>
                    </div>

                    <div style={styles.propActions}>
                      <button
                        style={styles.shareBtn}
                        onClick={() => shareProperty(prop)}
                      >
                        مشاركة
                      </button>

                      <button
                        style={styles.copyBtn}
                        onClick={() => copyPropertyLink(prop)}
                      >
                        نسخ
                      </button>

                      {can("edit") && (
                        <button
                          style={styles.editBtn}
                          onClick={() => editProperty(prop)}
                        >
                          تعديل
                        </button>
                      )}

                      {can("delete") && (
                        <button
                          style={styles.deleteBtn}
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
            <div style={styles.tabContent}>
              <h3 style={styles.tabTitle}>إدارة الموظفين</h3>

              <form style={styles.form} onSubmit={saveEmployee}>
                <div style={styles.formRow}>
                  <input
                    style={styles.input}
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
                    style={styles.input}
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

                <div style={styles.formRow}>
                  <input
                    style={styles.input}
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
                    style={styles.input}
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
                  style={styles.input}
                  placeholder="رابط واتساب"
                  value={employeeForm.whatsapp}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      whatsapp: e.target.value,
                    })
                  }
                />

                <div style={styles.fileInputWrapper}>
                  <label style={styles.fileLabel}>👤 صورة الموظف:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEmployeePhotoUpload}
                    style={styles.fileInput}
                  />
                </div>

                {employeeForm.photo && (
                  <div style={styles.employeePhotoPreviewBox}>
                    <img
                      src={employeeForm.photo}
                      alt="معاينة"
                      style={styles.employeePhotoPreview}
                    />
                  </div>
                )}

                <div style={styles.formRow}>
                  <button style={styles.addButton} type="submit">
                    {editingEmployee ? "حفظ بيانات الموظف" : "إضافة موظف"}
                  </button>

                  {editingEmployee && (
                    <button
                      style={styles.cancelButton}
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

              <div style={styles.employeeList}>
                {team.map((emp) => (
                  <div key={emp.id} style={styles.employeeCard}>
                    <div style={styles.employeeCardInfo}>
                      <div style={styles.employeeMiniPhotoBox}>
                        {emp.photo ? (
                          <img
                            src={emp.photo}
                            alt={emp.name}
                            style={styles.employeeMiniPhoto}
                          />
                        ) : (
                          <span>👤</span>
                        )}
                      </div>

                      <div>
                        <h4 style={styles.empName}>{emp.name}</h4>
                        <p style={styles.jobTitle}>{emp.title}</p>
                        <p style={styles.empContact}>الهاتف: {emp.phone}</p>
                      </div>
                    </div>

                    <div style={styles.empActions}>
                      <button
                        style={styles.editBtn}
                        onClick={() => {
                          setEditingEmployee(emp);
                          setEmployeeForm(emp);
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        style={styles.deleteBtn}
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
            <div style={styles.tabContent}>
              <h3 style={styles.tabTitle}>بيانات التواصل</h3>

              <form
                style={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  saveContact(contactData);
                  alert("تم حفظ بيانات التواصل");
                }}
              >
                <input
                  style={styles.input}
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
                  style={styles.input}
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
                  style={styles.input}
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
                  style={styles.input}
                  placeholder="رابط الخريطة"
                  value={contactData.maps}
                  onChange={(e) =>
                    setContactData({
                      ...contactData,
                      maps: e.target.value,
                    })
                  }
                />

                <button style={styles.addButton} type="submit">
                  حفظ البيانات
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      <section id="properties" style={styles.section}>
        <div style={styles.sectionHead}>
          <span style={styles.sectionLabel}>العروض العقارية</span>
          <h2 style={styles.sectionTitle}>العروض المتاحة</h2>
          <p style={styles.sectionText}>
            أحدث العروض العقارية المتاحة للبيع والشراء
          </p>
        </div>

        <div style={styles.propertyGrid}>
          {properties.map((item) => (
            <article style={styles.propertyCard} key={item.id}>
              <div style={styles.propertyImageWrapper}>
                <div style={styles.propertyImage}>
                  {item.image?.startsWith("data:image") ? (
                    <img
                      src={item.image}
                      alt={item.type}
                      style={styles.propertyUploadedImage}
                    />
                  ) : (
                    item.image || "🏡"
                  )}
                </div>

                {item.badge && item.badge !== "عادي" && (
                  <div style={styles.badgeLabel}>{item.badge}</div>
                )}
              </div>

              <div style={styles.propertyBody}>
                <h3 style={styles.cardTitle}>{item.type}</h3>
                <p style={styles.propertyLine}>📍 {item.location}</p>
                <p style={styles.propertyLine}>📐 {item.size}</p>
                <p style={styles.propertyLine}>💰 {item.price}</p>
                {item.note && (
                  <p style={styles.propertyNote}>✨ {item.note}</p>
                )}

                <div style={styles.propertyButtons}>
                  <a
                    style={styles.whatsapp}
                    href={`https://wa.me/${normalPhone(item.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    واتساب
                  </a>

                  <button
                    style={styles.shareBtnLarge}
                    onClick={() => shareProperty(item)}
                  >
                    مشاركة
                  </button>

                  <a style={styles.call} href={`tel:${item.phone}`}>
                    اتصال
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="team" style={styles.darkSection}>
        <div style={styles.inner}>
          <div style={styles.sectionHeadLight}>
            <span style={styles.goldLabel}>فريق التواصل</span>
            <h2 style={styles.darkTitle}>إدارة متخصصة لخدمتكم</h2>
            <p style={styles.darkText}>
              أرقام مباشرة لكل مسؤول لتسهيل الاستفسارات والعروض العقارية
              والتنسيق مع العملاء.
            </p>
          </div>

          <div style={styles.teamGrid}>
            {team.map((person) => (
              <article style={styles.teamCard} key={person.id}>
                <div style={styles.teamPhotoBox}>
                  {person.photo ? (
                    <img
                      src={person.photo}
                      alt={person.name}
                      style={styles.teamPhoto}
                    />
                  ) : (
                    <span style={styles.teamFallbackIcon}>👤</span>
                  )}
                </div>

                <p style={styles.job}>{person.title}</p>
                <h3 style={styles.name}>{person.name}</h3>
                <p style={styles.phone}>{person.phone}</p>

                <div style={styles.buttons}>
                  <a
                    style={styles.whatsapp}
                    href={
                      person.whatsapp ||
                      `https://wa.me/${normalPhone(person.phone)}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    واتساب
                  </a>
                  <a style={styles.outline} href={`tel:${person.phone}`}>
                    اتصال
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.facebookPromoCta}>
        <div>
          <h2 style={styles.facebookPromoTitle}>
            🎯 تابع أحدث عروضنا على فيسبوك
          </h2>
          <p style={styles.facebookPromoText}>
            لا تفوت أي عرض جديد! تابع صفحتنا على فيسبوك والتي نحدثها بأحدث
            العروض العقارية والفرص الاستثمارية المتاحة.
          </p>
        </div>

        <a
          style={styles.facebookPromoButton}
          href={contactData.facebook}
          target="_blank"
          rel="noreferrer"
        >
          متابعة فيسبوك
        </a>
      </section>

      <section id="promo" style={styles.section}>
        <div style={styles.sectionHead}>
          <span style={styles.sectionLabel}>QR Code</span>
          <h2 style={styles.sectionTitle}>بطاقة المكتب الإلكترونية</h2>
          <p style={styles.sectionText}>
            عند مسح الباركود تظهر صفحة فيها أرقام التواصل وروابط المكتب
          </p>
        </div>

        <div style={styles.promo}>
          <div>
            <span style={styles.badge}>امسح الباركود واحفظ بيانات المكتب</span>
            <h2 style={styles.promoTitle}>مكتب الضفتين العقاري</h2>
            <p style={styles.promoText}>
              بيع وشراء الأراضي والعقارات، وتسويق العروض العقارية باحترافية
              وسرعة في التواصل.
            </p>

            <div style={styles.infoBox}>
              {team.map((person) => (
                <p key={person.id} style={styles.infoLine}>
                  <strong>{person.title}</strong> - {person.name}:{" "}
                  {person.phone}
                </p>
              ))}
            </div>

            <div style={styles.buttons}>
              <a
                style={styles.whatsapp}
                href={contactData.whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                واتساب
              </a>
              <a
                style={styles.call}
                href={contactData.facebook}
                target="_blank"
                rel="noreferrer"
              >
                فيسبوك
              </a>
              <a
                style={styles.map}
                href={contactData.maps}
                target="_blank"
                rel="noreferrer"
              >
                الخريطة
              </a>
            </div>
          </div>

          <div style={styles.qrBox}>
            <img src={qrImage} alt="QR Code" style={styles.qr} />
            <h3 style={styles.qrTitle}>امسح الباركود</h3>
            <p style={styles.qrText}>للوصول إلى بيانات المكتب وروابط التواصل.</p>
          </div>
        </div>
      </section>

      <footer id="contact" style={styles.footer}>
        <h2 style={styles.footerTitle}>مكتب الضفتين العقاري</h2>
        <p style={styles.footerText}>
          بيع وشراء الأراضي والعقارات وتسويق العروض العقارية باحترافية.
        </p>

        <div style={styles.footerContacts}>
          {team.map((person) => (
            <a
              key={person.id}
              style={styles.footerLink}
              href={`tel:${person.phone}`}
            >
              {person.title} - {person.name}: {person.phone}
            </a>
          ))}
        </div>

        <div style={styles.buttonsCenter}>
          <a
            style={styles.call}
            href={contactData.facebook}
            target="_blank"
            rel="noreferrer"
          >
            صفحة فيسبوك
          </a>
          <a
            style={styles.map}
            href={contactData.maps}
            target="_blank"
            rel="noreferrer"
          >
            الموقع على الخريطة
          </a>
          <a
            style={styles.whatsapp}
            href={contactData.whatsapp}
            target="_blank"
            rel="noreferrer"
          >
            واتساب
          </a>
        </div>

        <p style={styles.copy}>© جميع الحقوق محفوظة لمكتب الضفتين العقاري</p>
      </footer>

      <div style={styles.floating}>
        <a
          style={styles.floatMap}
          href={contactData.maps}
          target="_blank"
          rel="noreferrer"
        >
          📍
        </a>
        <a
          style={styles.floatWhats}
          href={contactData.whatsapp}
          target="_blank"
          rel="noreferrer"
        >
          ☎️
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
  },

  userBanner: {
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
  height: "50%",
  objectFit: "contain",
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
    display: "inline-block",
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
    display: "inline-block",
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
    display: "inline-block",
    border: "none",
    cursor: "pointer",
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

  grid4: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "24px",
  },

  card: {
    background: "white",
    padding: "32px 24px",
    borderRadius: "20px",
    boxShadow: "0 2px 24px rgba(15,23,42,.06)",
    textAlign: "center",
    border: "1px solid #e2e8f0",
  },

  iconBox: {
    width: "64px",
    height: "64px",
    background: "#f0f9ff",
    borderRadius: "16px",
    display: "grid",
    placeItems: "center",
    fontSize: "32px",
    margin: "0 auto 16px",
  },

  cardTitle: {
    fontSize: "20px",
    fontWeight: "900",
    margin: "12px 0",
    color: "#061a44",
  },

  cardText: {
    fontSize: "14px",
    color: "#475569",
    lineHeight: "1.6",
  },

  facebookCta: {
    maxWidth: "1180px",
    margin: "0 auto 64px",
    padding: "48px",
    background: "#f0f9ff",
    borderRadius: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "32px",
    flexWrap: "wrap",
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
    display: "inline-block",
  },

  adminDashboard: {
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
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "24px",
  },

  propertyCard: {
    background: "white",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 2px 24px rgba(15,23,42,.06)",
    border: "1px solid #e2e8f0",
    transition: "transform 0.3s ease",
  },

  propertyImageWrapper: {
    position: "relative",
  },

  propertyImage: {
    width: "100%",
    height: "200px",
    background: "linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%)",
    display: "grid",
    placeItems: "center",
    fontSize: "64px",
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

  propertyBody: {
    padding: "18px",
  },

  propertyLine: {
    margin: "7px 0",
    fontSize: "14px",
    color: "#475569",
  },

  propertyNote: {
    fontSize: "13px",
    color: "#0b4aa2",
    fontStyle: "italic",
    background: "#f0f9ff",
    padding: "10px",
    borderRadius: "10px",
  },

  propertyButtons: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "16px",
  },

  darkSection: {
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
    display: "inline-block",
  },

  promo: {
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
    left: "24px",
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
    fontSize: "24px",
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
    fontSize: "24px",
    textDecoration: "none",
    boxShadow: "0 4px 16px rgba(5,150,105,.4)",
  },
};