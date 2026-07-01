/**
 * Coarse style family classifier, shared by the cloud-viz map, the k-NN purity
 * sweep, and the steering engine's soft style-family gate. Regex-based over the
 * raw corpus style string (or a BJCP canonical name — same shape).
 */
export const STYLE_FAMILIES = [
  "IPA",
  "Pale/Blonde",
  "Amber/Brown",
  "Stout/Porter",
  "Lager",
  "Wheat",
  "Belgian",
  "Sour/Wild",
  "Strong",
  "Other",
] as const;

export type StyleFamily = (typeof STYLE_FAMILIES)[number];

export function family(style: string): StyleFamily {
  const n = (style || "").toLowerCase();
  if (/sour|gose|lambic|berliner|brett|\bwild\b|kettle/.test(n)) return "Sour/Wild";
  if (/stout|porter/.test(n)) return "Stout/Porter";
  if (/ipa|india pale/.test(n)) return "IPA";
  if (/wheat|weiss|weizen|witbier|\bwit\b|hefe/.test(n)) return "Wheat";
  if (/saison|farmhouse|belgian|tripel|dubbel|\bquad|abbey|biere de|grisette/.test(n)) return "Belgian";
  if (/barley\s?wine|wee heavy|old ale|imperial|strong/.test(n)) return "Strong";
  if (/lager|pilsner|\bpils\b|helles|märzen|marzen|bock|schwarz|dunkel|festbier|common|steam/.test(n)) return "Lager";
  if (/brown|amber|\bred\b|altbier|\balt\b|bitter|\besb\b|\bmild\b|scottish/.test(n)) return "Amber/Brown";
  if (/pale ale|blonde|golden|kölsch|kolsch|cream ale|\bapa\b/.test(n)) return "Pale/Blonde";
  return "Other";
}
