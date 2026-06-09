/**
 * CompanyInfoService — best-effort company branding lookup.
 * Logo URL derived from company name via Clearbit (free, no key).
 * Banner is optional and never blocks UI. Falls back gracefully.
 */
export interface CompanyInfo {
  name: string;
  domain: string;
  logoUrl: string;
  bannerUrl: string;
  website: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh|sa|plc|technologies|technology|labs|solutions|systems)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

const DOMAIN_HINTS: Record<string, string> = {
  google: "google.com",
  microsoft: "microsoft.com",
  amazon: "amazon.com",
  meta: "meta.com",
  apple: "apple.com",
  netflix: "netflix.com",
  adobe: "adobe.com",
  salesforce: "salesforce.com",
  flipkart: "flipkart.com",
  zoho: "zoho.com",
  infosys: "infosys.com",
  deloitte: "deloitte.com",
  tcs: "tcs.com",
  wipro: "wipro.com",
  openai: "openai.com",
  anthropic: "anthropic.com",
};

export function getCompanyInfo(company: string): CompanyInfo {
  const clean = (company || "Company").trim();
  const slug = slugify(clean);
  const domain = DOMAIN_HINTS[slug] ?? (slug ? `${slug}.com` : "");
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : "";
  return {
    name: clean,
    domain,
    logoUrl,
    bannerUrl: "",
    website: domain ? `https://${domain}` : "",
  };
}
