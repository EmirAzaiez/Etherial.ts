/**
 * Calcul des créneaux libres.
 *
 * Tout ce fichier est pur : il reçoit les fenêtres, les blocages et l'agenda
 * déjà chargés, et rend les créneaux qui survivent. Pas de base, pas d'horloge —
 * `now` est un argument. C'est ce qui permet à la route de réservation de
 * rejouer exactement le même calcul juste avant d'écrire : un créneau choisi il
 * y a cinq minutes sur un téléphone est vérifié contre l'agenda tel qu'il est,
 * pas tel qu'il était.
 *
 * Les horaires sont stockés en minutes depuis minuit local. « Mardi 10:00–18:00 »
 * est une intention qui se répète, pas un instant : stocké en timestamp il
 * dériverait au changement d'heure. Dubaï est en UTC+4 fixe aujourd'hui, mais on
 * ne code pas le décalage en dur pour autant — la zone est un paramètre.
 */

// ─── Fuseau ──────────────────────────────────────────────────────────────────
// Intl est la seule base de fuseaux du runtime, et construire un DateTimeFormat
// coûte assez cher pour compter dans une boucle sur 60 jours × N agents.

const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string): Intl.DateTimeFormat {
    let f = FORMATTERS.get(tz)
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            weekday: 'short',
        })
        FORMATTERS.set(tz, f)
    }
    return f
}

const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
}

/** U M T W R F S du diagramme, dans l'ordre de `Date.getDay()`. */
export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['U', 'M', 'T', 'W', 'R', 'F', 'S']

/**
 * Le week-end par défaut : samedi et dimanche (`Date.getDay()`). Un projet le
 * change dans sa config (vendredi et samedi en Arabie saoudite), un scheduler
 * dans `weekend_days`.
 *
 * Il ne sert qu'à compter un préavis en jours ouvrés, pas à fermer quoi que ce
 * soit. Une plage ouverte le samedi le reste : ce sont deux questions
 * différentes, « quand reçoit-on » se règle plage par plage, « à partir de quand
 * peut-on réserver » se compte ici.
 */
export const DEFAULT_WEEKEND = [6, 0]

export type ZonedParts = {
    year: number
    month: number
    day: number
    /** 0 = dimanche … 6 = samedi, comme `Date.getDay()`. */
    weekday: number
    /** Minutes depuis minuit local. */
    minute: number
}

/** Ce que dit l'horloge murale, dans `tz`, à cet instant. */
export function zonedParts(date: Date, tz: string): ZonedParts {
    const parts = formatter(tz).formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
    // Minuit ressort en heure « 24 » sur certaines versions d'ICU.
    const hour = Number(get('hour')) % 24
    return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
        minute: hour * 60 + Number(get('minute')),
    }
}

function offsetMinutes(date: Date, tz: string): number {
    const p = zonedParts(date, tz)
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, Math.floor(p.minute / 60), p.minute % 60)
    return Math.round((asUtc - date.getTime()) / 60000)
}

/**
 * L'instant auquel une heure murale locale se produit.
 *
 * Deux passes : la première estimation utilise le décalage en vigueur à
 * l'instant naïf, la seconde le corrige si cette estimation est tombée de
 * l'autre côté d'un changement d'heure. Inutile à Dubaï, mais gratuit, et ça
 * évite d'avoir à revoir le moteur si un projet ouvre ailleurs.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, minute: number, tz: string): Date {
    const naive = Date.UTC(year, month - 1, day, 0, minute)
    const first = offsetMinutes(new Date(naive), tz)
    const candidate = naive - first * 60000
    const second = offsetMinutes(new Date(candidate), tz)
    return new Date(second === first ? candidate : naive - second * 60000)
}

/** Jour calendaire local d'un instant, en `YYYY-MM-DD` dans `tz`. */
export function zonedDayKey(date: Date, tz: string): string {
    const p = zonedParts(date, tz)
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** `HH:MM` depuis les minutes après minuit. */
export function minutesToLabel(minute: number): string {
    const h = Math.floor(minute / 60)
    const m = minute % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** `HH:MM` vers des minutes, tolérant sur `9:5`. Null si ce n'est pas une heure. */
export function labelToMinutes(label: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(label.trim())
    if (!match) return null
    const h = Number(match[1])
    const m = Number(match[2])
    if (h > 23 || m > 59) return null
    return h * 60 + m
}

/**
 * Accepte indifféremment `540`, `"540"` ou `"09:00"` et renvoie des minutes.
 *
 * Le back-office saisit des horaires, la base stocke des minutes : sans ça,
 * un admin qui tape naturellement « 09:00 » dans un champ entier ferait planter
 * l'insertion. Une valeur non interprétable est laissée telle quelle plutôt que
 * transformée en zéro — silencieusement ramener 09h00 à minuit serait pire que
 * l'erreur de validation.
 */
export function parseMinuteInput(value: unknown): unknown {
    if (typeof value !== 'string') return value

    const trimmed = value.trim()
    if (trimmed === '') return null

    const fromLabel = labelToMinutes(trimmed)
    if (fromLabel !== null) return fromLabel

    return value
}

/**
 * Une sélection de jours ramenée à des entiers 0–6, dédoublonnés et triés.
 *
 * Le back-office envoie tantôt `[2, 4]`, tantôt `["2", "4"]`, tantôt `"2"` quand
 * une seule case est cochée. Postgres attend un `integer[]` et refuserait les
 * deux dernières formes ; les trier rend aussi l'affichage stable d'une
 * sauvegarde à l'autre.
 */
export function toWeekdayList(value: unknown): number[] {
    const raw = Array.isArray(value) ? value : value === null || value === undefined || value === '' ? [] : [value]

    const days = raw
        .map((entry) => Number(entry))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)

    return [...new Set(days)].sort((a, b) => a - b)
}

// ─── Entrées ─────────────────────────────────────────────────────────────────

/**
 * Une plage horaire hebdomadaire du scheduler : « les mardis de 10:00 à 18:00 ».
 *
 * Contrairement à d'autres systèmes, la fenêtre appartient au scheduler (donc au
 * projet), pas à l'agent : le back-office définit les jours et les horaires, et
 * nomme les employés qui les tiennent.
 *
 * Elle se suffit à elle-même. Rythme et employés sont ici et nulle part ailleurs
 * — « lundi 08:00–19:00, créneaux de 15 minutes, 30 minutes de battement, Ahmed »
 * et « samedi matin, créneaux d'une heure, Fatima » sont deux lignes du même
 * scheduler avec deux rythmes, sans valeur par défaut à aller chercher plus haut.
 *
 * Un jour unique : une ligne du back-office qui coche plusieurs jours est étalée
 * en autant de fenêtres au chargement (`repository.ts`).
 */
export type BookingWindow = {
    weekday: number
    start_minute: number
    end_minute: number
    /** Longueur du rendez-vous produit par cette plage. */
    duration_minutes: number
    /** Écart entre deux débuts possibles — la maille de la grille. */
    slot_step_minutes: number
    /** Temps libre gardé de chaque côté d'un rendez-vous. */
    gap_minutes: number
    /** Plafond de rendez-vous pris dans cette plage, ce jour-là. */
    max_per_day?: number | null
    /** Les agents qui tiennent cette plage. Vide, personne ne la tient. */
    host_ids: number[]
}

/** Un agent candidat. */
export type BookingHost = {
    id: number
    /**
     * Combien de rendez-vous il peut tenir en même temps. 1 par défaut.
     *
     * Absent ou inférieur à 1, on retombe sur 1 : un agent dont la capacité
     * n'aurait pas été chargée doit se comporter comme avant, jamais comme un
     * agent sans limite.
     */
    capacity?: number
}

/**
 * Un blocage sur un jour local donné.
 *
 * `host_id: null` bloque tout le monde (jour férié, fermeture du projet).
 * `start_minute: null` bloque la journée entière — un jour off ne peut pas être
 * défait par une ligne partielle restée là.
 */
export type BookingBlock = {
    host_id: number | null
    /** `YYYY-MM-DD` local. */
    day: string
    start_minute: number | null
    end_minute: number | null
}

/** Un rendez-vous déjà pris. Millisecondes epoch, intervalle semi-ouvert. */
export type BusyInterval = {
    host_id: number
    start: number
    end: number
    /**
     * Si ce rendez-vous compte dans le plafond journalier du scheduler.
     *
     * Il est vrai pour les rendez-vous du même type et faux pour les autres :
     * un agent qui fait une visite n'est plus libre à cette heure-là, mais ça ne
     * consomme pas un des dix handovers autorisés ce jour-là. Le plafond de
     * l'agent, lui, compte tout — sa journée est pleine quoi qu'il y fasse.
     */
    counts_for_cap: boolean
}

/**
 * Ce qui borne le calendrier plutôt que la grille. Le reste — durée, pas,
 * battement, plafond — appartient à la plage, qui est la seule à savoir de quoi
 * elle est faite.
 *
 * Deux bornes, et elles ne parlent pas de la même chose. `visitsFrom` /
 * `visitsTo` disent **quand les visites ont lieu** : « on reçoit du 10 septembre
 * au 10 octobre ». `leadTimeDays` / `horizonDays` disent **quand on réserve** :
 * pas moins de deux semaines avant, pas plus de deux mois. Un projet qui reçoit
 * en septembre et se réserve un mois à l'avance ouvre donc ses réservations en
 * août sans qu'aucune date d'août ne soit jamais proposée — les deux axes se
 * traversent, ils ne se remplacent pas.
 */
export type SlotPolicy = {
    /** Préavis minimum, en jours de 24 heures comptés depuis maintenant. */
    leadTimeDays: number
    /**
     * Compter ce préavis en jours ouvrés plutôt qu'en jours calendaires.
     *
     * Un préavis de deux jours posé un jeudi tombe un samedi, et les équipes ne
     * sont pas là pour préparer la visite : deux jours veut dire deux jours de
     * travail. Les jours de `weekend` ne comptent plus.
     *
     * Le grain reste l'heure, comme en jours calendaires : deux jours ouvrés
     * valent quarante-huit heures dont on retire les week-ends, pas « le
     * surlendemain ouvré à partir de minuit ». Avec un week-end samedi-dimanche,
     * réserver jeudi à 14h ouvre lundi à 14h, et comme la journée ferme à 14h,
     * le premier rendez-vous possible est le mardi. Compter en journées
     * entières donnerait lundi, avec à peine plus d'une journée de travail pour
     * préparer la visite.
     */
    leadTimeWorkingDays?: boolean
    /** Les jours sautés en jours ouvrés (`Date.getDay()`). Défaut : `DEFAULT_WEEKEND`. */
    weekend?: number[]
    horizonDays: number
    /** Premier jour local `YYYY-MM-DD` où une visite peut tomber. `null` = dès aujourd'hui. */
    visitsFrom: string | null
    /** Dernier jour local `YYYY-MM-DD` où une visite peut tomber. `null` = sans fin. */
    visitsTo: string | null
}

export type Slot = {
    /** Instant ISO. */
    start: string
    end: string
    /** Jour local `YYYY-MM-DD`, pour regrouper côté client sans reconvertir. */
    day: string
    /** `HH:MM` local. */
    label: string
    /** Longueur de ce créneau : elle dépend de la plage qui l'a produit. */
    duration_minutes: number
    /** Tous les agents libres pour ce créneau, dans l'ordre où ils ont été fournis. */
    host_ids: number[]
    /**
     * Places encore prenables sur ce créneau, et places au total.
     *
     * Ce n'est pas le nombre d'agents : un employé qui reçoit six clients à la
     * fois est un agent et six places. Compter les agents donnait « 1 libre »
     * sur un créneau qui en avait six, et le même « 1 libre » quand il n'en
     * restait qu'une.
     *
     * `seats_free` ne descend jamais à zéro ici : un créneau complet n'est pas
     * rendu du tout.
     */
    seats_free: number
    seats_total: number
}

export type ComputeSlotsInput = {
    tz: string
    hosts: BookingHost[]
    windows: BookingWindow[]
    blocks: BookingBlock[]
    busy: BusyInterval[]
    policy: SlotPolicy
    from: Date
    to: Date
    now: Date
    /** S'arrêter après ce nombre d'heures de début distinctes. */
    limit?: number
}

// ─── Algèbre des fenêtres ────────────────────────────────────────────────────

type Window = { start: number; end: number }

function subtract(windows: Window[], cut: Window): Window[] {
    const out: Window[] = []
    for (const w of windows) {
        if (cut.end <= w.start || cut.start >= w.end) {
            out.push(w)
            continue
        }
        if (cut.start > w.start) out.push({ start: w.start, end: cut.start })
        if (cut.end < w.end) out.push({ start: cut.end, end: w.end })
    }
    return out
}

function merge(windows: Window[]): Window[] {
    const sorted = [...windows].filter((w) => w.end > w.start).sort((a, b) => a.start - b.start)
    const out: Window[] = []
    for (const w of sorted) {
        const last = out[out.length - 1]
        if (last && w.start <= last.end) last.end = Math.max(last.end, w.end)
        else out.push({ ...w })
    }
    return out
}

/** Un morceau de plage réellement ouvert, avec la plage dont il vient. */
export type OpenSegment = Window & { window: BookingWindow }

/**
 * Les plages qu'un agent travaille réellement un jour local donné : les fenêtres
 * hebdomadaires du type, moins ses blocages et ceux qui valent pour tout le monde.
 *
 * Les fenêtres ne sont volontairement **pas** fusionnées entre elles : chacune
 * porte ses propres réglages, et fondre « lundi matin, créneaux de 15 minutes »
 * avec « lundi après-midi, créneaux d'une heure » ferait disparaître la
 * distinction. Un blocage, lui, se soustrait de chaque fenêtre séparément, ce qui
 * peut en couper une en deux morceaux qui gardent tous les deux ses réglages.
 */
export function openSegments(hostId: number, weekday: number, dayKey: string, windows: BookingWindow[], blocks: BookingBlock[]): OpenSegment[] {
    const own = blocks.filter((b) => b.day === dayKey && (b.host_id === null || b.host_id === hostId))

    // Une journée entière bloquée l'emporte sur tout le reste.
    if (own.some((b) => b.start_minute === null)) return []

    const cuts = own.filter((b) => b.start_minute !== null && b.end_minute !== null)
    const out: OpenSegment[] = []

    for (const w of windows) {
        if (w.weekday !== weekday) continue
        // Une plage est tenue par les agents qu'elle nomme, et par eux seuls.
        if (!w.host_ids.includes(hostId)) continue

        let pieces: Window[] = [{ start: w.start_minute, end: w.end_minute }]
        for (const b of cuts) {
            pieces = subtract(pieces, { start: b.start_minute as number, end: b.end_minute as number })
        }

        for (const piece of pieces) out.push({ ...piece, window: w })
    }

    return out.sort((a, b) => a.start - b.start)
}

/**
 * @deprecated Gardé pour les appels qui n'ont que faire des réglages par plage.
 * Fusionne comme avant ; préférer `openSegments`.
 */
export function dayWindows(hostId: number, weekday: number, dayKey: string, windows: BookingWindow[], blocks: BookingBlock[]): Window[] {
    return merge(openSegments(hostId, weekday, dayKey, windows, blocks))
}

// ─── Le moteur ───────────────────────────────────────────────────────────────

/**
 * L'agenda d'un agent : ses rendez-vous triés par début, et la fin la plus
 * tardive rencontrée jusqu'à chaque rang.
 *
 * Ce second tableau n'est pas une optimisation, c'est ce qui rend la recherche
 * dichotomique licite. Tant qu'un agent ne tenait qu'un rendez-vous à la fois,
 * ses intervalles ne se chevauchaient pas et leurs fins étaient donc triées
 * comme leurs débuts — on pouvait chercher directement sur `end`. Dès qu'il en
 * tient plusieurs, un 10:00–11:00 peut précéder un 10:30–10:45 : les fins ne
 * sont plus croissantes, et une dichotomie sur `end` saute des rendez-vous qui
 * chevauchent pourtant le créneau testé. Sous-compter, ici, c'est surréserver.
 *
 * Le maximum courant, lui, est croissant par construction. Chercher dessus rend
 * au pire un index trop bas — quelques intervalles parcourus pour rien — et
 * jamais un index trop haut.
 */
type Diary = {
    intervals: BusyInterval[]
    /** `maxEnd[i]` = la plus grande fin parmi `intervals[0..i]`. */
    maxEnd: number[]
}

/** Index du premier intervalle qui pourrait encore chevaucher `from`. */
function firstCandidate(diary: Diary, from: number): number {
    let lo = 0
    let hi = diary.intervals.length
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (diary.maxEnd[mid] <= from) lo = mid + 1
        else hi = mid
    }
    return lo
}

/**
 * Le jour local suivant, via midi UTC pour qu'aucun calcul ne tombe dans un saut
 * d'heure.
 */
function weekdayOfDate(year: number, month: number, day: number): number {
    return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
}

function nextDay(year: number, month: number, day: number): [number, number, number] {
    const next = new Date(Date.UTC(year, month - 1, day, 12) + 86400000)
    return [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()]
}

/**
 * Le premier instant qu'un préavis laisse prendre.
 *
 * En jours calendaires, c'est un simple décalage de 24 heures par jour depuis
 * maintenant. En jours ouvrés, on avance de jour local en jour local en sautant
 * le week-end, et la journée atteinte s'ouvre dès minuit.
 */
export function leadTimeFloor(now: Date, leadTimeDays: number, workingDays: boolean, tz: string, weekend: number[] = DEFAULT_WEEKEND): number {
    const days = Math.max(0, Math.floor(leadTimeDays || 0))
    if (!workingDays) return now.getTime() + days * 86400000

    // Le préavis est une durée, pas un nombre de cases dans un calendrier : on
    // consomme les vingt-quatre heures de chaque jour travaillé, et un jour de
    // week-end n'en offre aucune. Ce qui reste de la journée en cours compte,
    // comme en jours calendaires.
    let remaining = days * 86400000
    let cursor = now.getTime()
    const parts = zonedParts(now, tz)
    let [year, month, day] = [parts.year, parts.month, parts.day]

    // Une borne dure : un préavis absurde ne doit pas faire tourner la boucle
    // indéfiniment. Deux ans de jours dépassent tout horizon réservable.
    for (let guard = 0; remaining > 0 && guard < 730; guard++) {
        const [nextYear, nextMonth, nextDate] = nextDay(year, month, day)
        const midnight = zonedTimeToUtc(nextYear, nextMonth, nextDate, 0, tz).getTime()

        if (!weekend.includes(weekdayOfDate(year, month, day))) {
            const available = midnight - cursor
            if (available >= remaining) return cursor + remaining
            remaining -= available
        }

        cursor = midnight
        ;[year, month, day] = [nextYear, nextMonth, nextDate]
    }

    return cursor
}

/**
 * Toutes les heures de début qu'au moins un agent peut prendre, entre `from` et `to`.
 *
 * On parcourt des jours locaux plutôt que des instants, pour qu'une fenêtre reste
 * attachée au jour pour lequel elle a été écrite, et on garde l'agenda de chaque
 * agent trié une fois pour que le test de chevauchement soit une recherche
 * dichotomique plutôt qu'un parcours complet.
 */
export function computeSlots(input: ComputeSlotsInput): Slot[] {
    const { tz, hosts, windows, blocks, busy, policy, now, limit } = input
    if (hosts.length === 0 || windows.length === 0) return []

    const earliest = Math.max(input.from.getTime(), leadTimeFloor(now, policy.leadTimeDays, !!policy.leadTimeWorkingDays, tz, policy.weekend))
    const latest = Math.min(input.to.getTime(), now.getTime() + policy.horizonDays * 86400000)
    if (earliest >= latest) return []

    // Un agenda trié par agent, plus un compteur par plage et par jour, pour
    // « pas plus de 4 handovers le lundi matin ».
    const diaries = new Map<number, Diary>()
    const perWindowPerDay = new Map<string, number>()

    const windowKey = new Map<BookingWindow, number>()
    windows.forEach((w, i) => windowKey.set(w, i))

    // Capacité par agent, lue une fois. Absente ou absurde, c'est 1 : un agent
    // mal chargé doit se comporter comme avant, pas comme un agent sans limite.
    const capacities = new Map<number, number>()
    for (const h of hosts) {
        diaries.set(h.id, { intervals: [], maxEnd: [] })
        capacities.set(h.id, Math.max(1, Math.floor(h.capacity ?? 1)))
    }

    for (const b of busy) {
        const parts = zonedParts(new Date(b.start), tz)
        const dayKey = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`

        if (b.counts_for_cap) {
            // Un rendez-vous compte pour la plage dans laquelle il a commencé.
            // Les plages ne se chevauchant pas, il n'y en a qu'une.
            for (const w of windows) {
                if (w.weekday !== parts.weekday) continue
                if (parts.minute < w.start_minute || parts.minute >= w.end_minute) continue
                const key = `${windowKey.get(w)}|${dayKey}`
                perWindowPerDay.set(key, (perWindowPerDay.get(key) ?? 0) + 1)
                break
            }
        }

        const diary = diaries.get(b.host_id)
        if (!diary) continue
        diary.intervals.push(b)
    }

    for (const diary of diaries.values()) {
        diary.intervals.sort((a, b) => a.start - b.start)

        let running = -Infinity
        diary.maxEnd = diary.intervals.map((interval) => {
            running = Math.max(running, interval.end)
            return running
        })
    }

    // Un créneau ne peut naître que d'une seule plage — elles ne se chevauchent
    // pas —, donc sa durée est celle de cette plage.
    const found = new Map<number, { hostIds: number[]; duration: number; seatsFree: number; seatsTotal: number }>()
    const cursor = zonedParts(new Date(earliest), tz)
    let year = cursor.year
    let month = cursor.month
    let day = cursor.day

    // Borné par l'horizon plutôt que par la seule condition de boucle, pour
    // qu'une plage aberrante ne parte pas en vrille : 400 jours dépasse tout
    // horizon raisonnable.
    for (let guard = 0; guard < 400; guard++) {
        const dayStart = zonedTimeToUtc(year, month, day, 0, tz)
        if (dayStart.getTime() > latest) break

        const parts = zonedParts(dayStart, tz)
        const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        // La période de visites borne les jours proposés, jamais le moment où on
        // réserve : passé son dernier jour plus rien n'existe, avant son premier
        // jour il n'y a rien à offrir mais on continue d'avancer pour l'atteindre
        // — c'est précisément ce qui permet de réserver en août pour septembre.
        if (policy.visitsTo && dayKey > policy.visitsTo) break

        if (policy.visitsFrom && dayKey < policy.visitsFrom) {
            ;[year, month, day] = nextDay(year, month, day)
            continue
        }

        for (const host of hosts) {
            const open = openSegments(host.id, parts.weekday, dayKey, windows, blocks)
            if (open.length === 0) continue

            const diary = diaries.get(host.id) as Diary
            const capacity = capacities.get(host.id) as number

            for (const segment of open) {
                const rules = segment.window
                const duration = Math.max(5, rules.duration_minutes)
                const step = Math.max(5, rules.slot_step_minutes)
                const gapMs = Math.max(0, rules.gap_minutes) * 60000

                // Le plafond de la plage ferme la plage, pas la journée : le
                // reste de la journée peut très bien rester ouvert.
                const cap = rules.max_per_day ?? null
                if (cap !== null && (perWindowPerDay.get(`${windowKey.get(rules)}|${dayKey}`) ?? 0) >= cap) {
                    continue
                }

                // La grille part du début de la plage, pas du morceau : un congé
                // de 10:00 à 10:30 ne doit pas décaler les créneaux de l'après-midi
                // sur une grille bancale. On avance jusqu'au premier début qui
                // tombe dans le morceau ouvert.
                let minute = rules.start_minute
                if (minute < segment.start) {
                    minute += Math.ceil((segment.start - minute) / step) * step
                }

                for (; minute + duration <= segment.end; minute += step) {
                    const startMs = zonedTimeToUtc(year, month, day, minute, tz).getTime()
                    if (startMs < earliest) continue
                    if (startMs > latest) break
                    const endMs = startMs + duration * 60000

                    // Combien de rendez-vous mordent déjà sur ce créneau, pas
                    // « y en a-t-il un ». Tant que l'agent en tient moins que sa
                    // capacité, il reste proposable. À capacité 1 la boucle sort
                    // sur le premier chevauchement, exactement comme avant.
                    let overlapping = 0
                    for (let i = firstCandidate(diary, startMs - gapMs); i < diary.intervals.length; i++) {
                        const b = diary.intervals[i]
                        if (b.start >= endMs + gapMs) break
                        if (b.end > startMs - gapMs) {
                            overlapping++
                            if (overlapping >= capacity) break
                        }
                    }
                    if (overlapping >= capacity) continue

                    const already = found.get(startMs)
                    if (already) {
                        already.hostIds.push(host.id)
                        already.seatsFree += capacity - overlapping
                        already.seatsTotal += capacity
                    } else {
                        found.set(startMs, {
                            hostIds: [host.id],
                            duration,
                            seatsFree: capacity - overlapping,
                            seatsTotal: capacity,
                        })
                    }
                }
            }
        }

        ;[year, month, day] = nextDay(year, month, day)
    }

    const ordered = [...found.entries()].sort((a, b) => a[0] - b[0])
    const capped = limit ? ordered.slice(0, limit) : ordered

    return capped.map(([startMs, entry]) => {
        const start = new Date(startMs)
        const parts = zonedParts(start, tz)
        return {
            start: start.toISOString(),
            end: new Date(startMs + entry.duration * 60000).toISOString(),
            day: zonedDayKey(start, tz),
            label: minutesToLabel(parts.minute),
            duration_minutes: entry.duration,
            host_ids: hosts.map((h) => h.id).filter((id) => entry.hostIds.includes(id)),
            seats_free: entry.seatsFree,
            seats_total: entry.seatsTotal,
        }
    })
}

/**
 * Si un début précis est encore réservable — le contrôle que la route de
 * réservation rejoue avant d'écrire. Même calcul que le sélecteur, resserré sur
 * la minute, pour que les deux ne puissent pas être en désaccord sur ce que
 * « libre » veut dire.
 *
 * Rend les agents encore disponibles et la durée que la plage donne à ce
 * créneau ; une liste vide veut dire créneau perdu. La durée vient d'ici plutôt
 * que du type parce qu'elle dépend de la plage : c'est le moteur qui sait
 * laquelle a produit ce début.
 */
export function openHostsAt(
    input: Omit<ComputeSlotsInput, 'from' | 'to' | 'limit'>,
    start: Date
): { host_ids: number[]; duration_minutes: number } {
    const slots = computeSlots({
        ...input,
        // Une minute de chaque côté : c'est la grille qui décide, pas la fenêtre.
        from: new Date(start.getTime() - 60000),
        to: new Date(start.getTime() + 60000),
    })

    const iso = start.toISOString()
    const slot = slots.find((s) => s.start === iso)

    // Sans créneau il n'y a pas de plage, donc pas de durée : `0` plutôt qu'un
    // repli inventé. L'appelant s'arrête sur `host_ids` vide avant d'en faire
    // quoi que ce soit.
    return {
        host_ids: slot?.host_ids ?? [],
        duration_minutes: slot?.duration_minutes ?? 0,
    }
}
