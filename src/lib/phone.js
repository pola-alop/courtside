// Telefono: prefisso internazionale, lunghezza del numero per paese, link.
// Dodicesimo modulo puro di `src/lib/` (nessun React, nessun Firestore).
//
// Sul documento avversario il telefono è `phone: { country, number } | null`:
// `country` è il codice ISO del paese (non il prefisso: +1 è di USA, Canada e
// mezzi Caraibi, +7 di Russia e Kazakistan, e la lunghezza giusta dipende dal
// paese), `number` sono le sole cifre nazionali, senza prefisso. Il prefisso
// si ricava da `country`.
//
// La tabella sotto è ricavata da PhoneNumberMetadata.xml di libphonenumber
// (Google, github.com/google/libphonenumber): per ogni paese le lunghezze dei
// numeri di CELLULARE (`possibleLengths` del tipo `mobile`), perché il campo
// serve a chiamare e scrivere su WhatsApp a una persona. Vale dunque per i
// cellulari: un fisso con una lunghezza diversa (in Italia 6-11 cifre) viene
// rifiutato. Sono valori di partenza da ritoccare a mano se un paese cambia
// piano di numerazione. Colonne: ISO, nome in italiano, prefisso, lunghezze
// valide, prefisso nazionale ("0" davanti ai numeri locali, vuoto se non c'è).
const COUNTRY_ROWS = [
  ['AF', 'Afghanistan', '93', [9], '0'],
  ['AL', 'Albania', '355', [9], '0'],
  ['DZ', 'Algeria', '213', [9], '0'],
  ['AD', 'Andorra', '376', [6, 9], ''],
  ['AO', 'Angola', '244', [9], ''],
  ['AI', 'Anguilla', '1', [10], '1'],
  ['AG', 'Antigua e Barbuda', '1', [10], '1'],
  ['SA', 'Arabia Saudita', '966', [9], '0'],
  ['AR', 'Argentina', '54', [10, 11], '0'],
  ['AM', 'Armenia', '374', [8], '0'],
  ['AW', 'Aruba', '297', [7], ''],
  ['AU', 'Australia', '61', [9], '0'],
  ['AT', 'Austria', '43', [7, 8, 9, 10, 11, 12, 13], '0'],
  ['AZ', 'Azerbaigian', '994', [9], '0'],
  ['BS', 'Bahamas', '1', [10], '1'],
  ['BH', 'Bahrein', '973', [8], ''],
  ['BD', 'Bangladesh', '880', [10], '0'],
  ['BB', 'Barbados', '1', [10], '1'],
  ['BE', 'Belgio', '32', [9], '0'],
  ['BZ', 'Belize', '501', [7], ''],
  ['BJ', 'Benin', '229', [10], ''],
  ['BM', 'Bermuda', '1', [10], '1'],
  ['BT', 'Bhutan', '975', [8], ''],
  ['BY', 'Bielorussia', '375', [9], '8'],
  ['BO', 'Bolivia', '591', [8], '0'],
  ['BA', 'Bosnia ed Erzegovina', '387', [8, 9], '0'],
  ['BW', 'Botswana', '267', [8], ''],
  ['BR', 'Brasile', '55', [10, 11], '0'],
  ['BN', 'Brunei', '673', [7], ''],
  ['BG', 'Bulgaria', '359', [8, 9], '0'],
  ['BF', 'Burkina Faso', '226', [8], ''],
  ['BI', 'Burundi', '257', [8], ''],
  ['KH', 'Cambogia', '855', [8, 9], '0'],
  ['CM', 'Camerun', '237', [9], ''],
  ['CA', 'Canada', '1', [10], '1'],
  ['CV', 'Capo Verde', '238', [7], ''],
  ['BQ', 'Caraibi Olandesi', '599', [7], ''],
  ['CZ', 'Cechia', '420', [9], ''],
  ['TD', 'Ciad', '235', [8], ''],
  ['CL', 'Cile', '56', [9], ''],
  ['CN', 'Cina', '86', [11], '0'],
  ['CY', 'Cipro', '357', [8], ''],
  ['VA', 'Città del Vaticano', '39', [9, 10], ''],
  ['CO', 'Colombia', '57', [10], '0'],
  ['KM', 'Comore', '269', [7], ''],
  ['CD', 'Congo - Kinshasa', '243', [7, 9], '0'],
  ['CG', 'Congo-Brazzaville', '242', [9], ''],
  ['KP', 'Corea del Nord', '850', [10], '0'],
  ['KR', 'Corea del Sud', '82', [9, 10], '0'],
  ['CI', 'Costa d’Avorio', '225', [10], ''],
  ['CR', 'Costa Rica', '506', [8], ''],
  ['HR', 'Croazia', '385', [8, 9], '0'],
  ['CU', 'Cuba', '53', [8], '0'],
  ['CW', 'Curaçao', '599', [7, 8], ''],
  ['DK', 'Danimarca', '45', [8], ''],
  ['DM', 'Dominica', '1', [10], '1'],
  ['EC', 'Ecuador', '593', [9], '0'],
  ['EG', 'Egitto', '20', [10], '0'],
  ['SV', 'El Salvador', '503', [8], ''],
  ['AE', 'Emirati Arabi Uniti', '971', [9], '0'],
  ['ER', 'Eritrea', '291', [7], '0'],
  ['EE', 'Estonia', '372', [7, 8], ''],
  ['SZ', 'Eswatini', '268', [8], ''],
  ['ET', 'Etiopia', '251', [9], '0'],
  ['FJ', 'Figi', '679', [7], ''],
  ['PH', 'Filippine', '63', [10], '0'],
  ['FI', 'Finlandia', '358', [6, 7, 8, 9, 10], '0'],
  ['FR', 'Francia', '33', [9], '0'],
  ['GA', 'Gabon', '241', [7, 8], ''],
  ['GM', 'Gambia', '220', [7, 9], ''],
  ['GE', 'Georgia', '995', [9], '0'],
  ['DE', 'Germania', '49', [10, 11], '0'],
  ['GH', 'Ghana', '233', [9], '0'],
  ['JM', 'Giamaica', '1', [10], '1'],
  ['JP', 'Giappone', '81', [10], '0'],
  ['GI', 'Gibilterra', '350', [8], ''],
  ['DJ', 'Gibuti', '253', [8], ''],
  ['JO', 'Giordania', '962', [9], '0'],
  ['GR', 'Grecia', '30', [10], ''],
  ['GD', 'Grenada', '1', [10], '1'],
  ['GL', 'Groenlandia', '299', [6], ''],
  ['GP', 'Guadalupa', '590', [9], '0'],
  ['GU', 'Guam', '1', [10], '1'],
  ['GT', 'Guatemala', '502', [8], ''],
  ['GG', 'Guernsey', '44', [10], '0'],
  ['GN', 'Guinea', '224', [9], ''],
  ['GQ', 'Guinea Equatoriale', '240', [9], ''],
  ['GW', 'Guinea-Bissau', '245', [9], ''],
  ['GY', 'Guyana', '592', [7], ''],
  ['GF', 'Guyana Francese', '594', [9], '0'],
  ['HT', 'Haiti', '509', [8], ''],
  ['HN', 'Honduras', '504', [8], ''],
  ['IN', 'India', '91', [10], '0'],
  ['ID', 'Indonesia', '62', [9, 10, 11, 12], '0'],
  ['IR', 'Iran', '98', [10], '0'],
  ['IQ', 'Iraq', '964', [10], '0'],
  ['IE', 'Irlanda', '353', [9], '0'],
  ['IS', 'Islanda', '354', [7, 9], ''],
  ['AC', 'Isola Ascensione', '247', [5], ''],
  ['CX', 'Isola Christmas', '61', [9], '0'],
  ['IM', 'Isola di Man', '44', [10], '0'],
  ['NF', 'Isola Norfolk', '672', [6], ''],
  ['AX', 'Isole Åland', '358', [6, 7, 8, 9, 10], '0'],
  ['KY', 'Isole Cayman', '1', [10], '1'],
  ['CC', 'Isole Cocos (Keeling)', '61', [9], '0'],
  ['CK', 'Isole Cook', '682', [5], ''],
  ['FO', 'Isole Fær Øer', '298', [6], ''],
  ['FK', 'Isole Falkland', '500', [5], ''],
  ['MP', 'Isole Marianne Settentrionali', '1', [10], '1'],
  ['MH', 'Isole Marshall', '692', [7], '1'],
  ['SB', 'Isole Salomone', '677', [5, 7], ''],
  ['TC', 'Isole Turks e Caicos', '1', [10], '1'],
  ['VI', 'Isole Vergini Americane', '1', [10], '1'],
  ['VG', 'Isole Vergini Britanniche', '1', [10], '1'],
  ['IL', 'Israele', '972', [9], '0'],
  ['IT', 'Italia', '39', [9, 10], ''],
  ['JE', 'Jersey', '44', [10], '0'],
  ['KZ', 'Kazakistan', '7', [10], '8'],
  ['KE', 'Kenya', '254', [9], '0'],
  ['KG', 'Kirghizistan', '996', [9], '0'],
  ['KI', 'Kiribati', '686', [8], '0'],
  ['XK', 'Kosovo', '383', [8], '0'],
  ['KW', 'Kuwait', '965', [8], ''],
  ['LA', 'Laos', '856', [9, 10], '0'],
  ['LS', 'Lesotho', '266', [8], ''],
  ['LV', 'Lettonia', '371', [8], ''],
  ['LB', 'Libano', '961', [7, 8], '0'],
  ['LR', 'Liberia', '231', [7, 9], '0'],
  ['LY', 'Libia', '218', [9], '0'],
  ['LI', 'Liechtenstein', '423', [7, 9], '0'],
  ['LT', 'Lituania', '370', [8], '0'],
  ['LU', 'Lussemburgo', '352', [9], ''],
  ['MK', 'Macedonia del Nord', '389', [8], '0'],
  ['MG', 'Madagascar', '261', [9], '0'],
  ['MW', 'Malawi', '265', [9], '0'],
  ['MY', 'Malaysia', '60', [9, 10], '0'],
  ['MV', 'Maldive', '960', [7], ''],
  ['ML', 'Mali', '223', [8], ''],
  ['MT', 'Malta', '356', [8], ''],
  ['MA', 'Marocco', '212', [9], '0'],
  ['MQ', 'Martinica', '596', [9], '0'],
  ['MR', 'Mauritania', '222', [8], ''],
  ['MU', 'Mauritius', '230', [8], ''],
  ['YT', 'Mayotte', '262', [9], '0'],
  ['MX', 'Messico', '52', [10], ''],
  ['FM', 'Micronesia', '691', [7], ''],
  ['MD', 'Moldavia', '373', [8], '0'],
  ['MC', 'Monaco', '377', [8, 9], '0'],
  ['MN', 'Mongolia', '976', [8], '0'],
  ['ME', 'Montenegro', '382', [8], '0'],
  ['MS', 'Montserrat', '1', [10], '1'],
  ['MZ', 'Mozambico', '258', [9], ''],
  ['MM', 'Myanmar (Birmania)', '95', [7, 8, 9, 10], '0'],
  ['NA', 'Namibia', '264', [9], '0'],
  ['NR', 'Nauru', '674', [7], ''],
  ['NP', 'Nepal', '977', [10], '0'],
  ['NI', 'Nicaragua', '505', [8], ''],
  ['NE', 'Niger', '227', [8], ''],
  ['NG', 'Nigeria', '234', [10], '0'],
  ['NU', 'Niue', '683', [4, 7], ''],
  ['NO', 'Norvegia', '47', [8], ''],
  ['NC', 'Nuova Caledonia', '687', [6], ''],
  ['NZ', 'Nuova Zelanda', '64', [8, 9, 10], '0'],
  ['OM', 'Oman', '968', [8], ''],
  ['NL', 'Paesi Bassi', '31', [9, 11], '0'],
  ['PK', 'Pakistan', '92', [10], '0'],
  ['PW', 'Palau', '680', [7], ''],
  ['PA', 'Panama', '507', [7, 8], ''],
  ['PG', 'Papua Nuova Guinea', '675', [8], ''],
  ['PY', 'Paraguay', '595', [9], '0'],
  ['PE', 'Perù', '51', [9], '0'],
  ['PF', 'Polinesia Francese', '689', [8], ''],
  ['PL', 'Polonia', '48', [9], ''],
  ['PT', 'Portogallo', '351', [9], ''],
  ['PR', 'Portorico', '1', [10], '1'],
  ['QA', 'Qatar', '974', [8], ''],
  ['HK', 'RAS di Hong Kong', '852', [8], ''],
  ['MO', 'RAS di Macao', '853', [8], ''],
  ['GB', 'Regno Unito', '44', [10], '0'],
  ['CF', 'Repubblica Centrafricana', '236', [8], ''],
  ['DO', 'Repubblica Dominicana', '1', [10], '1'],
  ['RE', 'Riunione', '262', [9], '0'],
  ['RO', 'Romania', '40', [9], '0'],
  ['RW', 'Ruanda', '250', [9], '0'],
  ['RU', 'Russia', '7', [10], '8'],
  ['EH', 'Sahara Occidentale', '212', [9], '0'],
  ['KN', 'Saint Kitts e Nevis', '1', [10], '1'],
  ['LC', 'Saint Lucia', '1', [10], '1'],
  ['MF', 'Saint Martin', '590', [9], '0'],
  ['VC', 'Saint Vincent e Grenadine', '1', [10], '1'],
  ['BL', 'Saint-Barthélemy', '590', [9], '0'],
  ['PM', 'Saint-Pierre e Miquelon', '508', [6, 9], '0'],
  ['WS', 'Samoa', '685', [7, 10], ''],
  ['AS', 'Samoa Americane', '1', [10], '1'],
  ['SM', 'San Marino', '378', [8], ''],
  ['SH', 'Sant’Elena', '290', [5], ''],
  ['ST', 'São Tomé e Príncipe', '239', [7], ''],
  ['SN', 'Senegal', '221', [9], ''],
  ['RS', 'Serbia', '381', [8, 9, 10], '0'],
  ['SC', 'Seychelles', '248', [7], ''],
  ['SL', 'Sierra Leone', '232', [8], '0'],
  ['SG', 'Singapore', '65', [8], ''],
  ['SX', 'Sint Maarten', '1', [10], '1'],
  ['SY', 'Siria', '963', [9], '0'],
  ['SK', 'Slovacchia', '421', [9], '0'],
  ['SI', 'Slovenia', '386', [8], '0'],
  ['SO', 'Somalia', '252', [7, 8, 9], '0'],
  ['ES', 'Spagna', '34', [9], ''],
  ['LK', 'Sri Lanka', '94', [9], '0'],
  ['US', 'Stati Uniti', '1', [10], '1'],
  ['SS', 'Sud Sudan', '211', [9], '0'],
  ['ZA', 'Sudafrica', '27', [5, 6, 7, 8, 9], '0'],
  ['SD', 'Sudan', '249', [9], '0'],
  ['SR', 'Suriname', '597', [7], ''],
  ['SJ', 'Svalbard e Jan Mayen', '47', [8], ''],
  ['SE', 'Svezia', '46', [9], '0'],
  ['CH', 'Svizzera', '41', [9], '0'],
  ['TJ', 'Tagikistan', '992', [9], ''],
  ['TW', 'Taiwan', '886', [9], '0'],
  ['TZ', 'Tanzania', '255', [9], '0'],
  ['PS', 'Territori Palestinesi', '970', [9], '0'],
  ['IO', 'Territorio Britannico dell’Oceano Indiano', '246', [7], ''],
  ['TH', 'Thailandia', '66', [9], '0'],
  ['TL', 'Timor Est', '670', [8], ''],
  ['TG', 'Togo', '228', [8], ''],
  ['TK', 'Tokelau', '690', [4, 5, 6, 7], ''],
  ['TO', 'Tonga', '676', [7], ''],
  ['TT', 'Trinidad e Tobago', '1', [10], '1'],
  ['TN', 'Tunisia', '216', [8], ''],
  ['TR', 'Turchia', '90', [10], '0'],
  ['TM', 'Turkmenistan', '993', [8], '8'],
  ['TV', 'Tuvalu', '688', [6, 7], ''],
  ['UA', 'Ucraina', '380', [9], '0'],
  ['UG', 'Uganda', '256', [9], '0'],
  ['HU', 'Ungheria', '36', [9], '06'],
  ['UY', 'Uruguay', '598', [8], '0'],
  ['UZ', 'Uzbekistan', '998', [9], ''],
  ['VU', 'Vanuatu', '678', [7], ''],
  ['VE', 'Venezuela', '58', [10], '0'],
  ['VN', 'Vietnam', '84', [9], '0'],
  ['WF', 'Wallis e Futuna', '681', [6], ''],
  ['YE', 'Yemen', '967', [9], '0'],
  ['ZM', 'Zambia', '260', [9], '0'],
  ['ZW', 'Zimbabwe', '263', [9], '0'],
]

export const DEFAULT_PHONE_COUNTRY = 'IT'

// Bandiera dal codice ISO: ogni lettera diventa il suo "indicatore regionale"
// Unicode e la coppia viene disegnata come bandiera dal sistema.
export function flagEmoji(iso) {
  return [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')
}

// Italia in testa (è il caso d'uso), poi l'ordine alfabetico della tabella.
const toCountry = ([iso, name, dial, lengths, trunk]) => ({ iso, name, dial, lengths, trunk, flag: flagEmoji(iso) })
export const PHONE_COUNTRIES = [
  ...COUNTRY_ROWS.filter(r => r[0] === DEFAULT_PHONE_COUNTRY),
  ...COUNTRY_ROWS.filter(r => r[0] !== DEFAULT_PHONE_COUNTRY),
].map(toCountry)

export const PHONE_COUNTRY_BY_ISO = Object.fromEntries(PHONE_COUNTRIES.map(c => [c.iso, c]))

// "10", "9 o 10", "da 7 a 13" (intervallo pieno di più di due valori), "8, 9 e 11".
export function lengthsText(lengths) {
  const l = [...lengths].sort((a, b) => a - b)
  if (l.length === 1) return `${l[0]}`
  if (l.length === 2) return `${l[0]} o ${l[1]}`
  if (l[l.length - 1] - l[0] === l.length - 1) return `da ${l[0]} a ${l[l.length - 1]}`
  return `${l.slice(0, -1).join(', ')} o ${l[l.length - 1]}`
}

const onlyDigits = raw => (raw || '').replace(/\D/g, '')

// Cosa si accetta di scrivere accanto alle cifre: spazi, trattini, punti,
// parentesi. Tutto il resto (lettere, "+") non è un numero da correggere in
// silenzio ma un errore da dire.
const ALLOWED_SEPARATORS = /^[\d\s\-.()]*$/

// Le cifre nazionali di ciò che è stato scritto. Se il paese ha un prefisso
// nazionale ("0" nel Regno Unito: 07911 123456) e il numero è valido solo
// senza quello, lo si toglie: con il prefisso internazionale quello zero non
// si compone più. Altrimenti le cifre restano com'è.
export function phoneNumberFor(country, raw) {
  const digits = onlyDigits(raw)
  const c = PHONE_COUNTRY_BY_ISO[country]
  if (!c || !c.trunk) return digits
  if (c.lengths.includes(digits.length)) return digits
  if (digits.startsWith(c.trunk) && c.lengths.includes(digits.length - c.trunk.length)) {
    return digits.slice(c.trunk.length)
  }
  return digits
}

// Il problema di un numero, o null. Vuoto = nessun problema: il telefono è
// facoltativo e un campo svuotato resta vuoto, senza valori d'ufficio.
export function phoneIssue(country, raw) {
  const text = (raw || '').trim()
  if (!text) return null
  const c = PHONE_COUNTRY_BY_ISO[country]
  if (!c) return 'Scegli il prefisso del paese.'
  if (text.includes('+')) return 'Il prefisso si sceglie a sinistra: scrivi solo il numero.'
  if (!ALLOWED_SEPARATORS.test(text)) return 'Il numero può contenere solo cifre.'
  const n = phoneNumberFor(country, text).length
  if (c.lengths.includes(n)) return null
  return `Per ${c.name} (+${c.dial}) servono ${lengthsText(c.lengths)} cifre: ne hai scritte ${n}.`
}

// Il valore da salvare: null se vuoto. Presuppone che `phoneIssue` sia null.
export function phoneFields(country, raw) {
  const number = phoneNumberFor(country, raw)
  return number ? { country, number } : null
}

const validPhone = phone => !!phone && !!PHONE_COUNTRY_BY_ISO[phone.country] && !!phone.number

// "+39 3331234567"; null se non c'è un telefono.
export function formatPhone(phone) {
  if (!validPhone(phone)) return null
  return `+${PHONE_COUNTRY_BY_ISO[phone.country].dial} ${phone.number}`
}

export function phoneHref(phone) {
  if (!validPhone(phone)) return null
  return `tel:+${PHONE_COUNTRY_BY_ISO[phone.country].dial}${phone.number}`
}

// wa.me vuole il numero internazionale in sole cifre, senza "+".
export function whatsappHref(phone) {
  if (!validPhone(phone)) return null
  return `https://wa.me/${PHONE_COUNTRY_BY_ISO[phone.country].dial}${phone.number}`
}
