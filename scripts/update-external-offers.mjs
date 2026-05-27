import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_OFFERS = Number(process.env.MAX_EXTERNAL_OFFERS || 36);
const now = new Date().toISOString();
const today = now.slice(0, 10);

function normalizeSupabaseUrl(value = "") {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const parsed = new URL(trimmed);
  if (!parsed.hostname.endsWith(".supabase.co")) {
    throw new Error(
      "SUPABASE_URL must be the project URL like https://PROJECT_REF.supabase.co"
    );
  }

  return parsed.origin;
}

const trustedSources = [
  {
    name: "دليل عقار",
    url: "https://daleelaqar.com/search/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA-%D9%84%D9%84%D8%A8%D9%8A%D8%B9/%D8%A7%D8%B1%D8%A8%D8%AF",
    host: "daleelaqar.com",
  },
];

const allowedTypes = ["أرض", "شقة", "مبنى", "فيلا", "منزل", "مزرعة", "محل"];
const targetAreaTerms = [
  "اربد",
  "إربد",
  "ايدون",
  "إيدون",
  "بشرى",
  "الحصن",
  "الصريح",
  "حوارة",
  "بيت-راس",
  "بيت راس",
  "النعيمة",
  "كفر-يوبا",
  "كفر يوبا",
  "المغير",
  "السريج",
  "حكما",
  "زبدة-فركوح",
  "زبدة فركوح",
  "البارحه",
  "البارحة",
];

function unique(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function decodeSegment(value = "") {
  try {
    return decodeURIComponent(value).replace(/-/g, " ").trim();
  } catch {
    return value.replace(/-/g, " ").trim();
  }
}

function absolutizeUrl(base, href) {
  return new URL(href, base).href;
}

function sourceKey(value) {
  const parsed = new URL(value);
  return `${parsed.origin}${decodeSegment(parsed.pathname)}`;
}

function formatPrice(value, currency = "JOD") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "السعر حسب المصدر / عند التواصل";
  }

  const formatted = new Intl.NumberFormat("en-US").format(amount);
  return currency === "JOD" ? `${formatted} دينار` : `${formatted} ${currency}`;
}

function extractStructuredPrices(html) {
  const match = html.match(
    /<script[^>]+id=["']search-jsonld["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return new Map();

  try {
    const data = JSON.parse(match[1]);
    const items = data.mainEntity?.itemListElement || [];
    return new Map(
      items
        .map((entry) => {
          const item = entry.item || {};
          const itemUrl = item.url || item["@id"];
          const price = item.offers?.price;
          if (!itemUrl || price === undefined || price === null) return null;

          return [
            sourceKey(itemUrl),
            formatPrice(price, item.offers?.priceCurrency || "JOD"),
          ];
        })
        .filter(Boolean)
    );
  } catch (error) {
    console.warn("Could not parse structured offer prices.", error);
    return new Map();
  }
}

function extractLinks(html, source) {
  const matches = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => href.includes("/nav/") && href.includes("/للبيع/"))
    .map((href) => absolutizeUrl(source.url, href));

  return unique(matches, (link) => link).slice(0, MAX_OFFERS * 3);
}

function parseDaleelOffer(sourceUrl, sourceName, sourcePrice) {
  const url = new URL(sourceUrl);
  const parts = url.pathname.split("/").filter(Boolean).map(decodeSegment);
  const saleIndex = parts.indexOf("للبيع");
  if (saleIndex < 3) return null;

  const type = parts[saleIndex - 1] || "";
  const area = parts[saleIndex + 1] || "";
  const listingCode = parts.at(-1) || "";
  const locality = parts[3] || "إربد";
  const basin = parts[5] || "";
  const location = ["إربد", locality, basin].filter(Boolean).join(" - ");
  const normalizedPath = parts.join(" ");
  const sizeMatch = area.match(/(\d+)\s*متر/);

  if (!allowedTypes.some((allowed) => type.includes(allowed))) return null;
  if (!targetAreaTerms.some((term) => normalizedPath.includes(term))) return null;
  if (!sizeMatch) return null;
  if (!listingCode || listingCode.length < 4) return null;

  return {
    type,
    location,
    size: `${sizeMatch[1]} م²`,
    price: sourcePrice || "السعر حسب المصدر / عند التواصل",
    source_name: sourceName,
    source_url: sourceUrl,
    checked_at: today,
    status: "published",
    quality_score: 85,
    updated_at: now,
    note:
      "عرض مرصود آليًا من مصدر عقاري معلن ضمن نطاق إربد ومناطقها. يتم التحقق من التوفر والسعر قبل أي تواصل أو اتفاق.",
  };
}

async function fetchOffersFromSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; MoenRealEstateBot/1.0; +https://moen-site.vercel.app)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status}`);
  }

  const html = await response.text();
  const pricesByUrl = extractStructuredPrices(html);
  return extractLinks(html, source)
    .map((link) => parseDaleelOffer(link, source.name, pricesByUrl.get(sourceKey(link))))
    .filter(Boolean)
    .slice(0, MAX_OFFERS);
}

async function collectOffers() {
  const batches = await Promise.allSettled(trustedSources.map(fetchOffersFromSource));
  const offers = batches.flatMap((batch) => {
    if (batch.status === "fulfilled") return batch.value;
    console.warn(batch.reason);
    return [];
  });

  return unique(offers, (offer) => offer.source_url).slice(0, MAX_OFFERS);
}

async function main() {
  const offers = await collectOffers();
  console.log(`Qualified external offers: ${offers.length}`);
  offers.forEach((offer, index) => {
    console.log(
      `${index + 1}. ${offer.type} | ${offer.location} | ${offer.size} | ${offer.price}`
    );
  });

  if (DRY_RUN) return;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for automatic external offers update."
    );
  }

  if (!offers.length) {
    console.log("No qualified offers found. Nothing to upsert.");
    return;
  }

  const supabase = createClient(normalizeSupabaseUrl(SUPABASE_URL), SUPABASE_KEY);
  const sourceNames = trustedSources.map((source) => source.name);
  const { data: existingOffers, error: existingError } = await supabase
    .from("external_offers")
    .select("id, source_url")
    .in("source_name", sourceNames);

  if (existingError) throw existingError;

  const existingUrls = new Set((existingOffers || []).map((offer) => offer.source_url));
  const currentUrls = new Set(offers.map((offer) => offer.source_url));
  const newOffersCount = offers.filter((offer) => !existingUrls.has(offer.source_url)).length;

  const { error } = await supabase
    .from("external_offers")
    .upsert(offers, { onConflict: "source_url" });

  if (error) throw error;

  const staleIds = (existingOffers || [])
    .filter((offer) => !currentUrls.has(offer.source_url))
    .map((offer) => offer.id);

  if (staleIds.length) {
    const { error: archiveError } = await supabase
      .from("external_offers")
      .update({ status: "archived", updated_at: now })
      .in("id", staleIds);

    if (archiveError) throw archiveError;
  }

  console.log(
    `Upserted ${offers.length} external offers. New: ${newOffersCount}. Archived stale: ${staleIds.length}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
