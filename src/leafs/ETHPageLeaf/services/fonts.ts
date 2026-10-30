// ──────────────────────────────────────────────────────────────────────────
// The fonts a page can be written in: Google Fonts (free, OFL). The web loads
// them from Google's stylesheet; the app downloads their files, one TTF per
// weight with every script in it, and keeps them. A page has two kinds of
// words: its titles (headings, a cover's, an image & text's, the page's own)
// and its text (the rest). The back-office picks a font for each, for every
// page; a block may take one font for all its words.
// ──────────────────────────────────────────────────────────────────────────

export interface PageFont {
    id: string
    /** Its name, in a stylesheet and in the editor. */
    family: string
    category: 'sans' | 'serif'
    /** Has the Arabic letters. Without them, an Arabic page shows its words in the phone's own font. */
    arabic: boolean
    weights: number[]
    italic: boolean
    /** Its TTF files, those it has of `'300'` (light titles), `'400'`, `'500'`, `'600'`, `'700'` and `'400i'` (italic). */
    files: Record<string, string>
}

/** A page's fonts: the ids of `FONTS`. One left out is the theme's, else the system's. */
export interface PageFonts {
    title?: string
    text?: string
}

// The files are Google's own addresses (versioned): written down here, the app needs no lookup.
export const FONTS: PageFont[] = [
    { id: 'rubik', family: 'Rubik', category: 'sans', arabic: true, weights: [300, 400, 500, 600, 700], italic: true, files: { '300': 'https://fonts.gstatic.com/s/rubik/v31/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-WYi1UA.ttf', '400': 'https://fonts.gstatic.com/s/rubik/v31/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-B4i1UA.ttf', '500': 'https://fonts.gstatic.com/s/rubik/v31/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-NYi1UA.ttf', '600': 'https://fonts.gstatic.com/s/rubik/v31/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-2Y-1UA.ttf', '700': 'https://fonts.gstatic.com/s/rubik/v31/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-4I-1UA.ttf', '400i': 'https://fonts.gstatic.com/s/rubik/v31/iJWbBXyIfDnIV7nEt3KSJbVDV49rz8tdE0Uw.ttf' } },
    { id: 'inter', family: 'Inter', category: 'sans', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', '500': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf', '600': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf', '700': 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', '400i': 'https://fonts.gstatic.com/s/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dthjQ.ttf' } },
    { id: 'dm-sans', family: 'DM Sans', category: 'sans', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf', '500': 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkJxhTg.ttf', '600': 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAfJthTg.ttf', '700': 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf', '400i': 'https://fonts.gstatic.com/s/dmsans/v17/rP2rp2ywxg089UriCZaSExd86J3t9jz86Mvy4qCRAL19DksVat-JDW3z.ttf' } },
    { id: 'manrope', family: 'Manrope', category: 'sans', arabic: false, weights: [400, 500, 600, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F.ttf', '500': 'https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk7PFO_F.ttf', '600': 'https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4jE-_F.ttf', '700': 'https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4aE-_F.ttf' } },
    { id: 'plus-jakarta-sans', family: 'Plus Jakarta Sans', category: 'sans', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU7NSg.ttf', '500': 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_m07NSg.ttf', '600': 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_d0nNSg.ttf', '700': 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_TknNSg.ttf', '400i': 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIZaomQNQcsA88c7O9yZ4KMCoOg4KozySKCdSNG9OcqYQ0lCR_Q.ttf' } },
    { id: 'poppins', family: 'Poppins', category: 'sans', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrFJA.ttf', '500': 'https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLGT9V1s.ttf', '600': 'https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6V1s.ttf', '700': 'https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7V1s.ttf', '400i': 'https://fonts.gstatic.com/s/poppins/v24/pxiGyp8kv8JHgFVrJJLedw.ttf' } },
    { id: 'montserrat', family: 'Montserrat', category: 'sans', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf', '500': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Ew-.ttf', '600': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu170w-.ttf', '700': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf', '400i': 'https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq6R9aX8.ttf' } },
    { id: 'ibm-plex-sans-arabic', family: 'IBM Plex Sans Arabic', category: 'sans', arabic: true, weights: [400, 500, 600, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3CZRtWPQCuHme67tEYUIx3Kh0PHR9N6bs6.ttf', '500': 'https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPO_9CT.ttf', '600': 'https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YPi-NCT.ttf', '700': 'https://fonts.gstatic.com/s/ibmplexsansarabic/v15/Qw3NZRtWPQCuHme67tEYUIx3Kh0PHR9N6YOG-dCT.ttf' } },
    { id: 'cairo', family: 'Cairo', category: 'sans', arabic: true, weights: [400, 500, 600, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf', '500': 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hNI-W1Q.ttf', '600': 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hD45W1Q.ttf', '700': 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf' } },
    { id: 'tajawal', family: 'Tajawal', category: 'sans', arabic: true, weights: [400, 500, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/tajawal/v12/Iura6YBj_oCad4k1rzY.ttf', '500': 'https://fonts.gstatic.com/s/tajawal/v12/Iurf6YBj_oCad4k1l8KiLrY.ttf', '700': 'https://fonts.gstatic.com/s/tajawal/v12/Iurf6YBj_oCad4k1l4qkLrY.ttf' } },
    { id: 'noto-kufi-arabic', family: 'Noto Kufi Arabic', category: 'sans', arabic: true, weights: [400, 500, 600, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/notokufiarabic/v27/CSRp4ydQnPyaDxEXLFF6LZVLKrodhu8t57o1kDc5Wh5v34bP.ttf', '500': 'https://fonts.gstatic.com/s/notokufiarabic/v27/CSRp4ydQnPyaDxEXLFF6LZVLKrodhu8t57o1kDc5Wh5d34bP.ttf', '600': 'https://fonts.gstatic.com/s/notokufiarabic/v27/CSRp4ydQnPyaDxEXLFF6LZVLKrodhu8t57o1kDc5Wh6x2IbP.ttf', '700': 'https://fonts.gstatic.com/s/notokufiarabic/v27/CSRp4ydQnPyaDxEXLFF6LZVLKrodhu8t57o1kDc5Wh6I2IbP.ttf' } },
    { id: 'readex-pro', family: 'Readex Pro', category: 'sans', arabic: true, weights: [400, 500, 600, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/readexpro/v27/SLXnc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2KY8TL0kGZN6blTC4USmgg.ttf', '500': 'https://fonts.gstatic.com/s/readexpro/v27/SLXnc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2KY8TL0kGZN6blTC00Smgg.ttf', '600': 'https://fonts.gstatic.com/s/readexpro/v27/SLXnc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2KY8TL0kGZN6blTCP0Omgg.ttf', '700': 'https://fonts.gstatic.com/s/readexpro/v27/SLXnc1bJ7HE5YDoGPuzj_dh8uc7wUy8ZQQyX2KY8TL0kGZN6blTCBkOmgg.ttf' } },
    { id: 'alexandria', family: 'Alexandria', category: 'sans', arabic: true, weights: [400, 500, 600, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9r7TqbH.ttf', '500': 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9rJTqbH.ttf', '600': 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9olSabH.ttf', '700': 'https://fonts.gstatic.com/s/alexandria/v6/UMBCrPdDqW66y0Y2usFeQCH18mulUxBvI9ocSabH.ttf' } },
    { id: 'el-messiri', family: 'El Messiri', category: 'sans', arabic: true, weights: [400, 500, 600, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/elmessiri/v25/K2FhfZBRmr9vQ1pHEey6GIGo8_pv3myYjuXwe65g.ttf', '500': 'https://fonts.gstatic.com/s/elmessiri/v25/K2FhfZBRmr9vQ1pHEey6GIGo8_pv3myYjuXCe65g.ttf', '600': 'https://fonts.gstatic.com/s/elmessiri/v25/K2FhfZBRmr9vQ1pHEey6GIGo8_pv3myYjuUufK5g.ttf', '700': 'https://fonts.gstatic.com/s/elmessiri/v25/K2FhfZBRmr9vQ1pHEey6GIGo8_pv3myYjuUXfK5g.ttf' } },
    { id: 'noto-naskh-arabic', family: 'Noto Naskh Arabic', category: 'serif', arabic: true, weights: [400, 500, 600, 700], italic: false, files: { '400': 'https://fonts.gstatic.com/s/notonaskharabic/v44/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krA.ttf', '500': 'https://fonts.gstatic.com/s/notonaskharabic/v44/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwj85krA.ttf', '600': 'https://fonts.gstatic.com/s/notonaskharabic/v44/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwY8lkrA.ttf', '700': 'https://fonts.gstatic.com/s/notonaskharabic/v44/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwWslkrA.ttf' } },
    { id: 'playfair-display', family: 'Playfair Display', category: 'serif', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf', '500': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vUDQ.ttf', '600': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKebukDQ.ttf', '700': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf', '400i': 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtY.ttf' } },
    { id: 'lora', family: 'Lora', category: 'serif', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787weuyJG.ttf', '500': 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787wsuyJG.ttf', '600': 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787zAvCJG.ttf', '700': 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787z5vCJG.ttf', '400i': 'https://fonts.gstatic.com/s/lora/v37/0QI8MX1D_JOuMw_hLdO6T2wV9KnW-MoFkqg.ttf' } },
    { id: 'cormorant-garamond', family: 'Cormorant Garamond', category: 'serif', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_v86GnM.ttf', '500': 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_s06GnM.ttf', '600': 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_iE9GnM.ttf', '700': 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_hg9GnM.ttf', '400i': 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jDOjw.ttf' } },
    { id: 'dm-serif-display', family: 'DM Serif Display', category: 'serif', arabic: false, weights: [400], italic: true, files: { '400': 'https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFnOHM81r4j6k0gjAW3mujVU2B2K_c.ttf', '400i': 'https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFhOHM81r4j6k0gjAW3mujVU2B2G_Vx1w.ttf' } },
    { id: 'fraunces', family: 'Fraunces', category: 'serif', arabic: false, weights: [400, 500, 600, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIctxujDg.ttf', '500': 'https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIchRujDg.ttf', '600': 'https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcaRyjDg.ttf', '700': 'https://fonts.gstatic.com/s/fraunces/v38/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcUByjDg.ttf', '400i': 'https://fonts.gstatic.com/s/fraunces/v38/6NVf8FyLNQOQZAnv9ZwNjucMHVn85Ni7emAe9lKqZTnbB-gzTK0K1ChJdt9vIVYX9G37lvd9sPEKsxx664UJf1hLTf7W.ttf' } },
    { id: 'amiri', family: 'Amiri', category: 'serif', arabic: true, weights: [400, 700], italic: true, files: { '400': 'https://fonts.gstatic.com/s/amiri/v30/J7aRnpd8CGxBHqUp.ttf', '700': 'https://fonts.gstatic.com/s/amiri/v30/J7acnpd8CGxBHp2VkZY4.ttf', '400i': 'https://fonts.gstatic.com/s/amiri/v30/J7afnpd8CGxBHpUrtLY.ttf' } },
    { id: 'marcellus', family: 'Marcellus', category: 'serif', arabic: false, weights: [400], italic: false, files: { '400': 'https://fonts.gstatic.com/s/marcellus/v14/wEO_EBrOk8hQLDvIAF8FUQ.ttf' } },
]

const BY_ID = new Map(FONTS.map((f) => [f.id, f]))

export function fontOf(id: unknown): PageFont | undefined {
    return typeof id === 'string' ? BY_ID.get(id) : undefined
}

/** The id of a font the pages can use; anything else is no font. */
export function fontIdOf(id: unknown): string | undefined {
    return fontOf(id)?.id
}

/** The fonts the back-office picks from: what the editor lists, without the files. */
export function fontCatalog() {
    return FONTS.map(({ files: _files, ...font }) => font)
}

/** A font, then what the system shows when it is not there yet (or for the letters it doesn't have). */
export function fontStack(font: PageFont | undefined, fallback: string): string {
    if (!font) return fallback
    const generic = font.category === 'serif' ? "Georgia, 'Times New Roman', serif" : fallback
    return `'${font.family}', ${generic}`
}

/** Google's stylesheet for these fonts, in the weights they have. */
export function googleFontsHref(fonts: PageFont[]): string {
    const families = fonts.map((f) => {
        const axes = f.italic ? `ital,wght@${[...f.weights.map((w) => `0,${w}`), '1,400'].join(';')}` : `wght@${f.weights.join(';')}`
        return `family=${f.family.replace(/ /g, '+')}:${axes}`
    })
    return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

/** Every font these words are drawn in: the page's two, and the blocks' own. */
export function fontsIn(fonts: PageFonts, blocks: { style?: { font?: string } }[]): PageFont[] {
    const ids = [fonts.title, fonts.text, ...blocks.map((b) => b.style?.font)]
    return [...new Set(ids.map(fontOf).filter((f): f is PageFont => !!f))]
}
