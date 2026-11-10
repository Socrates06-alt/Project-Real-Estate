/** Country dialing codes (ISO code → code without "+"). Names come from the browser in English. */
const CODES =
  "IN91 AE971 SA966 QA974 KW965 OM968 BH973 US1 GB44 CA1 AU61 NZ64 SG65 MY60 DE49 IE353 " +
  "AF93 AL355 DZ213 AD376 AO244 AG1 AR54 AM374 AT43 AZ994 BS1 BD880 BB1 BY375 BE32 BZ501 BJ229 BT975 BO591 " +
  "BA387 BW267 BR55 BN673 BG359 BF226 BI257 KH855 CM237 CV238 CF236 TD235 CL56 CN86 CO57 KM269 CG242 CD243 " +
  "CR506 CI225 HR385 CU53 CY357 CZ420 DK45 DJ253 DM1 DO1 EC593 EG20 SV503 GQ240 ER291 EE372 SZ268 ET251 FJ679 " +
  "FI358 FR33 GA241 GM220 GE995 GH233 GR30 GD1 GT502 GN224 GW245 GY592 HT509 HN504 HK852 HU36 IS354 ID62 IR98 " +
  "IQ964 IL972 IT39 JM1 JP81 JO962 KZ7 KE254 KI686 KR82 XK383 KG996 LA856 LV371 LB961 LS266 LR231 LY218 LI423 " +
  "LT370 LU352 MO853 MG261 MW265 MV960 ML223 MT356 MH692 MR222 MU230 MX52 FM691 MD373 MC377 MN976 ME382 MA212 " +
  "MZ258 MM95 NA264 NR674 NP977 NL31 NI505 NE227 NG234 MK389 NO47 PK92 PW680 PS970 PA507 PG675 PY595 PE51 PH63 " +
  "PL48 PT351 PR1 RO40 RU7 RW250 KN1 LC1 VC1 WS685 SM378 ST239 SN221 RS381 SC248 SL232 SK421 SI386 SB677 SO252 " +
  "ZA27 SS211 ES34 LK94 SD249 SR597 SE46 CH41 SY963 TW886 TJ992 TZ255 TH66 TL670 TG228 TO676 TT1 TN216 TR90 " +
  "TM993 TV688 UG256 UA380 UY598 UZ998 VU678 VA39 VE58 VN84 YE967 ZM260 ZW263";

const names = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

// Flag pictures (emoji flags show as letters on Windows). Each file loads only when its flag is shown.
const FLAGS = import.meta.glob("../../../node_modules/flag-icons/flags/4x3/*.svg", {
  query: "?no-inline",
  import: "default",
  eager: true,
}) as Record<string, string>;
const flagUrl = (iso: string) => FLAGS[`../../../node_modules/flag-icons/flags/4x3/${iso.toLowerCase()}.svg`] ?? "";

export type Country = { iso: string; dial: string; name: string; flag: string };

const all: Country[] = CODES.split(" ").map((c) => {
  const iso = c.slice(0, 2);
  return { iso, dial: c.slice(2), name: names?.of(iso) ?? iso, flag: flagUrl(iso) };
});
const [first, ...rest] = all;
/** India first, then Gulf and other common NRI countries already near the top; the rest A–Z by name. */
export const COUNTRIES: Country[] = [first, ...rest.slice(0, 15), ...rest.slice(15).sort((a, b) => a.name.localeCompare(b.name))];

/** Split "+971501234567" into its country and local number (longest matching code wins; no "+" means India). */
export function splitPhone(value: string | undefined): { iso: string; number: string } {
  const v = (value ?? "").trim();
  if (!v.startsWith("+")) return { iso: "IN", number: v };
  const digits = v.replace(/\D/g, "");
  const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => digits.startsWith(c.dial));
  return match ? { iso: match.iso, number: digits.slice(match.dial.length) } : { iso: "IN", number: digits };
}

export function joinPhone(iso: string, number: string): string {
  const n = number.replace(/[^\d]/g, "");
  if (!n) return "";
  const c = COUNTRIES.find((x) => x.iso === iso) ?? COUNTRIES[0];
  return `+${c.dial}${c.dial === "91" ? n.replace(/^0/, "") : n.replace(/^0+/, "")}`;
}
