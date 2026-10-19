import type { Lang } from "./i18n";

/** Countries used in products.country (English names), with the German name and a flag. */
export const COUNTRY_INFO: Record<string, { de: string; flag: string }> = {
  Nigeria: { de: "Nigeria", flag: "🇳🇬" },
  Ghana: { de: "Ghana", flag: "🇬🇭" },
  "Côte d'Ivoire": { de: "Elfenbeinküste", flag: "🇨🇮" },
  Cameroon: { de: "Kamerun", flag: "🇨🇲" },
  "DR Congo": { de: "DR Kongo", flag: "🇨🇩" },
  "West Africa": { de: "Westafrika", flag: "🌍" },
  Ethiopia: { de: "Äthiopien", flag: "🇪🇹" },
  Eritrea: { de: "Eritrea", flag: "🇪🇷" },
  "South Africa": { de: "Südafrika", flag: "🇿🇦" },
  Egypt: { de: "Ägypten", flag: "🇪🇬" },
  Tunisia: { de: "Tunesien", flag: "🇹🇳" },
  Morocco: { de: "Marokko", flag: "🇲🇦" },
  Lebanon: { de: "Libanon", flag: "🇱🇧" },
  Turkey: { de: "Türkei", flag: "🇹🇷" },
  Iran: { de: "Iran", flag: "🇮🇷" },
  India: { de: "Indien", flag: "🇮🇳" },
  Pakistan: { de: "Pakistan", flag: "🇵🇰" },
  Thailand: { de: "Thailand", flag: "🇹🇭" },
  Vietnam: { de: "Vietnam", flag: "🇻🇳" },
  Indonesia: { de: "Indonesien", flag: "🇮🇩" },
  Philippines: { de: "Philippinen", flag: "🇵🇭" },
  China: { de: "China", flag: "🇨🇳" },
  "South Korea": { de: "Südkorea", flag: "🇰🇷" },
  Jamaica: { de: "Jamaika", flag: "🇯🇲" },
  Mexico: { de: "Mexiko", flag: "🇲🇽" },
  Colombia: { de: "Kolumbien", flag: "🇨🇴" },
  Peru: { de: "Peru", flag: "🇵🇪" },
  Venezuela: { de: "Venezuela", flag: "🇻🇪" },
  Brazil: { de: "Brasilien", flag: "🇧🇷" },
  USA: { de: "USA", flag: "🇺🇸" },
  UK: { de: "Großbritannien", flag: "🇬🇧" },
  France: { de: "Frankreich", flag: "🇫🇷" },
  Germany: { de: "Deutschland", flag: "🇩🇪" },
  Netherlands: { de: "Niederlande", flag: "🇳🇱" },
  Belgium: { de: "Belgien", flag: "🇧🇪" },
  Norway: { de: "Norwegen", flag: "🇳🇴" },
};

export function countryLabel(name: string | null | undefined, lang: Lang, withFlag = false) {
  if (!name) return "";
  const info = COUNTRY_INFO[name];
  const label = lang === "de" ? info?.de ?? name : name;
  return withFlag && info ? `${info.flag} ${label}` : label;
}

export const countryFlag = (name: string | null | undefined) => (name ? COUNTRY_INFO[name]?.flag ?? "" : "");
