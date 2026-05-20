import fs from "node:fs";

const t = fs.readFileSync(
	"node_modules/nucleo-flags/dist/types/components/index.d.ts",
	"utf8",
);
const icons = new Set(
	[...t.matchAll(/export \* from '\.\/(Icon[A-Za-z0-9]+)/g)].map((m) => m[1]),
);
const iconList = [...icons].sort();
const norm = (s) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
const dn = new Intl.DisplayNames(["en"], { type: "region" });
const iso =
	"AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
		" ",
	);

const overrides = {
	CI: "IconIvoryCoast",
	GB: "IconUnitedKingdom",
	US: "IconUnitedStates",
	AE: "IconUnitedArabEmirates",
	CD: "IconDemocraticRepublicCongo",
	CG: "IconRepublicCongo",
	CV: "IconCapeVerde",
	CZ: "IconCzechia",
	SZ: "IconEswatini",
	MK: "IconNorthMacedonia",
	BA: "IconBosniaHerzegovina",
	BN: "IconBrunei",
	BO: "IconBolivia",
	FM: "IconMicronesia",
	GW: "IconGuineaBissau",
	HK: "IconHongKong",
	IR: "IconIran",
	KP: "IconNorthKorea",
	KR: "IconSouthKorea",
	LA: "IconLaos",
	MD: "IconMoldova",
	RU: "IconRussia",
	SY: "IconSyria",
	TW: "IconTaiwan",
	TZ: "IconTanzania",
	VN: "IconVietnam",
	VE: "IconVenezuela",
	VU: "IconVanuatu",
	VA: "IconVaticanCity",
	PS: "IconPalestine",
	TL: "IconEastTimor",
	TR: "IconTurkey",
	DO: "IconDominicanRepublic",
	SV: "IconElSalvador",
	ST: "IconSaoTomePrincipe",
	KN: "IconSaintKittsNevis",
	LC: "IconSaintLucia",
	VC: "IconSaintVincentGrenadines",
	TT: "IconTrinidadTobago",
	PG: "IconPapuaNewGuinea",
	NZ: "IconNewZealand",
	SA: "IconSaudiArabia",
	SB: "IconSolomonIslands",
	GS: "IconSouthGeorgiaSandwichIslands",
	SS: "IconSouthSudan",
	MF: "IconSintMaarten",
	CW: "IconCuracao",
	BQ: "IconNetherlandsAntilles",
	AX: "IconAalandIslands",
	MO: "IconMacau",
	MQ: "IconMartinique",
	GP: "IconGuadeloupe",
	GF: "IconFrenchGuiana",
	PF: "IconFrenchPolynesia",
	NC: "IconNewCaledonia",
	EH: "IconWesternSahara",
	FK: "IconFalklandIslands",
	IO: "IconUnitedKingdom",
	SH: "IconUnitedKingdom",
	PN: "IconUnitedKingdom",
	TC: "IconTurksAndCaicosIslands",
	VG: "IconBritishVirginIslands",
	VI: "IconUnitedStatesVirginIslands",
	UM: "IconUnitedStates",
	GU: "IconUnitedStates",
	PR: "IconPuertoRico",
	AS: "IconUnitedStates",
	MP: "IconUnitedStates",
	MZ: "IconMozanbique",
	RE: "IconFrance",
	YT: "IconFrance",
	BL: "IconFrance",
	TF: "IconFrance",
	BV: "IconAntarctica",
	HM: "IconAntarctica",
	AQ: "IconAntarctica",
	MS: "IconUnitedKingdom",
	FO: "IconDenmark",
	GL: "IconDenmark",
	SJ: "IconNorway",
	CC: "IconAustralia",
	CX: "IconAustralia",
	NF: "IconAustralia",
	PM: "IconFrance",
	TK: "IconNewZealand",
	WF: "IconFrenchPolynesia",
};

const map = {};
for (const code of iso) {
	if (overrides[code]) {
		map[code] = overrides[code];
		continue;
	}
	const name = dn.of(code);
	const candidates = [
		`Icon${name.replace(/\s+/g, "")}`,
		`Icon${name.replace(/\s+and\s+/gi, "")}`,
	];
	let hit = candidates.find((c) => icons.has(c));
	if (!hit) hit = iconList.find((i) => norm(i.slice(4)) === norm(name));
	if (hit) map[code] = hit;
}

const lines = Object.entries(map).map(([k, v]) => `\t${k}: "${v}",`);
const out = `/** ISO 3166-1 alpha-2 → nucleo-flags component export name. */\nexport const NUCLEO_FLAG_BY_ISO = {\n${lines.join("\n")}\n} as const;\n\nexport type NucleoFlagIconName = (typeof NUCLEO_FLAG_BY_ISO)[keyof typeof NUCLEO_FLAG_BY_ISO];\n`;
fs.writeFileSync("src/lib/nucleo-flag-by-iso.ts", out);
console.log("wrote", Object.keys(map).length, "entries");
