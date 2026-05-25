import { motion } from "framer-motion";
import {
  Building2,
  MapPin,
  Phone,
  MessageCircle,
  Facebook,
  Search,
  Handshake,
  ShieldCheck,
  Home,
  LandPlot,
  ArrowUpLeft,
  CheckCircle2,
} from "lucide-react";
import "./App.css";

const FACEBOOK_URL = "https://www.facebook.com/share/1BtQWMWQgv/";
const MAPS_URL = "https://maps.app.goo.gl/EWoAmhkhp5GmMhfB8";
const BANNER_IMAGE = "/9c049017-4f6a-4029-9071-700b2fdf099a.png";

const team = [
  {
    name: "المختار محمود عبابنه",
    title: "مدير عام",
    phone: "00962772050566",
  },
  {
    name: "معين عبابنه",
    title: "مدير علاقات عامة",
    phone: "00962796181720",
  },
  {
    name: "زيد عبابنه",
    title: "مدير علاقات خارجية",
    phone: "00962797022220",
  },
];

const services = [
  {
    icon: <LandPlot />,
    title: "بيع وشراء الأراضي",
    text: "تسويق الأراضي السكنية والتجارية والزراعية وربط البائع بالمشتري بوضوح واحترافية.",
  },
  {
    icon: <Home />,
    title: "بيع وشراء العقارات",
    text: "عرض المنازل، الشقق، المزارع، والمحلات بطريقة جذابة مع متابعة جادة للمهتمين.",
  },
  {
    icon: <Search />,
    title: "البحث عن فرص عقارية",
    text: "مساعدة العملاء في العثور على العقار المناسب حسب الموقع، الميزانية، والمساحة المطلوبة.",
  },
  {
    icon: <Handshake />,
    title: "وساطة عقارية موثوقة",
    text: "تسهيل التواصل بين الأطراف وتنظيم خطوات البيع والشراء بأسلوب واضح ومهني.",
  },
];

const properties = [
  { type: "أرض سكنية", location: "موقع مميز", size: "تضاف المساحة", price: "السعر عند الاتصال" },
  { type: "منزل للبيع", location: "داخل منطقة مخدومة", size: "تفاصيل العقار", price: "حسب العرض" },
  { type: "أرض تجارية", location: "شارع حيوي", size: "تضاف المساحة", price: "تواصل للاستفسار" },
];

function normalizePhone(phone) {
  return phone.replace(/^00962/, "962").replace(/^0/, "962");
}

function WhatsAppButton({ phone, label }) {
  return (
    <a className="btn whatsapp" href={`https://wa.me/${normalizePhone(phone)}`} target="_blank" rel="noreferrer">
      <MessageCircle size={20} />
      {label}
    </a>
  );
}

export default function App() {
  const mainPhone = team[0].phone;

  return (
    <main dir="rtl">
      <section className="hero">
        <div className="glow glow-one"></div>
        <div className="glow glow-two"></div>

        <nav className="nav container">
          <div className="brand">
            <div className="brand-icon">
              <Building2 />
            </div>
            <div>
              <h2>مكتب الضفتين العقاري</h2>
              <p>بيع وشراء الأراضي والعقارات</p>
            </div>
          </div>

          <div className="nav-links">
            <a href="#services">خدماتنا</a>
            <a href="#team">فريق العمل</a>
            <a href="#properties">العروض</a>
            <a href="#contact">تواصل معنا</a>
          </div>
        </nav>

        <div className="container banner-wrap">
          <motion.img
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="banner-img"
            src={BANNER_IMAGE}
            alt="مكتب الضفتين العقاري - بيع وشراء الأراضي والعقارات"
          />
        </div>

        <div className="container hero-grid">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="badge">
              <ShieldCheck size={18} />
              مؤسسة تسويق عقاري بخدمة مباشرة وفريق متخصص
            </span>
            <h1>نسوّق عقارك باحتراف ونوصلك بالمشتري الجاد</h1>
            <p className="hero-text">
              مكتب الضفتين العقاري يقدم خدمات البيع والشراء والتسويق العقاري للأراضي والعقارات، مع فريق إداري متخصص
              للتواصل السريع، العلاقات العامة، والعلاقات الخارجية.
            </p>

            <div className="actions">
              <WhatsAppButton phone={mainPhone} label="واتساب المدير العام" />
              <a className="btn call" href={`tel:${team[1].phone}`}>
                <Phone size={20} />
                اتصل الآن
              </a>
            </div>
          </motion.div>

          <motion.div className="identity-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.65 }}>
            <div className="card-inner">
              <div className="card-head">
                <div>
                  <p>بطاقة المؤسسة</p>
                  <h2>الضفتين العقاري</h2>
                </div>
                <div className="card-logo">
                  <Building2 />
                </div>
              </div>

              <div className="checks">
                {["بيع الأراضي", "شراء العقارات", "تسويق العروض", "استشارات عقارية"].map((item) => (
                  <div className="check-row" key={item}>
                    <CheckCircle2 />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="small-banner">
                <img src={BANNER_IMAGE} alt="هوية مكتب الضفتين العقاري" />
                <p>هوية واضحة مستوحاة من إعلان المكتب مع ألوان الأزرق والذهبي ولمسات عقارية احترافية.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="services" className="section container">
        <div className="section-title">
          <p>خدماتنا</p>
          <h2>حلول عقارية متكاملة</h2>
          <span>نخدم ملاك العقارات والباحثين عن فرص مناسبة من خلال تسويق واضح وتواصل مباشر.</span>
        </div>

        <div className="services-grid">
          {services.map((service) => (
            <article className="service-card" key={service.title}>
              <div className="service-icon">{service.icon}</div>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="team" className="team-section">
        <div className="container">
          <div className="section-title center light">
            <p>فريق التواصل</p>
            <h2>إدارة متخصصة لخدمتكم</h2>
            <span>أرقام مباشرة لكل مسؤول لتسهيل الاستفسارات، العروض العقارية، والتنسيق مع العملاء.</span>
          </div>

          <div className="team-grid">
            {team.map((member, index) => (
              <motion.article
                className="team-card"
                key={member.phone}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
              >
                <div className="team-icon">
                  <Handshake />
                </div>
                <p className="job">{member.title}</p>
                <h3>{member.name}</h3>
                <a className="phone-line" href={`tel:${member.phone}`}>
                  <Phone size={18} />
                  {member.phone}
                </a>
                <div className="team-actions">
                  <WhatsAppButton phone={member.phone} label="تواصل واتساب" />
                  <a className="btn outline" href={`tel:${member.phone}`}>
                    <Phone size={20} />
                    اتصال مباشر
                  </a>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="properties" className="section white">
        <div className="container">
          <div className="section-title row-title">
            <div>
              <p>العروض العقارية</p>
              <h2>نماذج للعقارات المتاحة</h2>
            </div>
            <a className="facebook-link" href={FACEBOOK_URL} target="_blank" rel="noreferrer">
              <Facebook size={20} />
              مشاهدة صفحة فيسبوك
              <ArrowUpLeft size={16} />
            </a>
          </div>

          <div className="properties-grid">
            {properties.map((property) => (
              <article className="property-card" key={property.type}>
                <div className="property-image">
                  <Building2 />
                </div>
                <div className="property-body">
                  <h3>{property.type}</h3>
                  <p><MapPin size={16} /> {property.location}</p>
                  <p>المساحة: <strong>{property.size}</strong></p>
                  <p>السعر: <strong>{property.price}</strong></p>
                  <WhatsAppButton phone={mainPhone} label="استفسار واتساب" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="why container">
        <div className="why-card">
          <div>
            <p>لماذا تختارنا؟</p>
            <h2>خبرة، وضوح، وسرعة في التواصل</h2>
            <span>نعرض العقارات بشكل احترافي، نوفر معلومات واضحة، ونسهّل التواصل المباشر للاستفسار أو ترتيب المعاينة.</span>
          </div>
          <div className="why-list">
            {["إعلانات عقارية منظمة", "تواصل مباشر مع المكتب", "متابعة المهتمين بجدية", "عرض احترافي على الجوال"].map((item) => (
              <div key={item}>
                <CheckCircle2 />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact">
        <div className="container footer-grid">
          <div>
            <h2>مكتب الضفتين العقاري</h2>
            <p>بيع وشراء الأراضي والعقارات، وتسويق العروض العقارية باحترافية.</p>
          </div>

          <div>
            <h3>أرقام التواصل</h3>
            {team.map((member) => (
              <a key={member.phone} href={`tel:${member.phone}`}>
                <Phone size={16} />
                {member.title} - {member.name}: {member.phone}
              </a>
            ))}
          </div>

          <div>
            <h3>روابط مهمة</h3>
            <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
              <Facebook size={16} />
              صفحة فيسبوك
            </a>
            <a href={MAPS_URL} target="_blank" rel="noreferrer">
              <MapPin size={16} />
              موقعنا على الخريطة
            </a>
            <WhatsAppButton phone={mainPhone} label="تواصل واتساب" />
          </div>
        </div>
        <div className="copy">© جميع الحقوق محفوظة لمكتب الضفتين العقاري</div>
      </footer>

      <div className="floating">
        <a href={MAPS_URL} target="_blank" rel="noreferrer" aria-label="الموقع على الخريطة">
          <MapPin />
        </a>
        <a href={`https://wa.me/${normalizePhone(mainPhone)}`} target="_blank" rel="noreferrer" aria-label="واتساب">
          <MessageCircle />
        </a>
      </div>
    </main>
  );
}
