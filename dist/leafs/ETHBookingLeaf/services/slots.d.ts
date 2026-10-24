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
/** U M T W R F S du diagramme, dans l'ordre de `Date.getDay()`. */
export declare const WEEKDAY_LABELS: string[];
export declare const WEEKDAY_SHORT: string[];
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
export declare const DEFAULT_WEEKEND: number[];
export type ZonedParts = {
    year: number;
    month: number;
    day: number;
    /** 0 = dimanche … 6 = samedi, comme `Date.getDay()`. */
    weekday: number;
    /** Minutes depuis minuit local. */
    minute: number;
};
/** Ce que dit l'horloge murale, dans `tz`, à cet instant. */
export declare function zonedParts(date: Date, tz: string): ZonedParts;
/**
 * L'instant auquel une heure murale locale se produit.
 *
 * Deux passes : la première estimation utilise le décalage en vigueur à
 * l'instant naïf, la seconde le corrige si cette estimation est tombée de
 * l'autre côté d'un changement d'heure. Inutile à Dubaï, mais gratuit, et ça
 * évite d'avoir à revoir le moteur si un projet ouvre ailleurs.
 */
export declare function zonedTimeToUtc(year: number, month: number, day: number, minute: number, tz: string): Date;
/** Jour calendaire local d'un instant, en `YYYY-MM-DD` dans `tz`. */
export declare function zonedDayKey(date: Date, tz: string): string;
/** `HH:MM` depuis les minutes après minuit. */
export declare function minutesToLabel(minute: number): string;
/** `HH:MM` vers des minutes, tolérant sur `9:5`. Null si ce n'est pas une heure. */
export declare function labelToMinutes(label: string): number | null;
/**
 * Accepte indifféremment `540`, `"540"` ou `"09:00"` et renvoie des minutes.
 *
 * Le back-office saisit des horaires, la base stocke des minutes : sans ça,
 * un admin qui tape naturellement « 09:00 » dans un champ entier ferait planter
 * l'insertion. Une valeur non interprétable est laissée telle quelle plutôt que
 * transformée en zéro — silencieusement ramener 09h00 à minuit serait pire que
 * l'erreur de validation.
 */
export declare function parseMinuteInput(value: unknown): unknown;
/**
 * Une sélection de jours ramenée à des entiers 0–6, dédoublonnés et triés.
 *
 * Le back-office envoie tantôt `[2, 4]`, tantôt `["2", "4"]`, tantôt `"2"` quand
 * une seule case est cochée. Postgres attend un `integer[]` et refuserait les
 * deux dernières formes ; les trier rend aussi l'affichage stable d'une
 * sauvegarde à l'autre.
 */
export declare function toWeekdayList(value: unknown): number[];
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
    weekday: number;
    start_minute: number;
    end_minute: number;
    /** Longueur du rendez-vous produit par cette plage. */
    duration_minutes: number;
    /** Écart entre deux débuts possibles — la maille de la grille. */
    slot_step_minutes: number;
    /** Temps libre gardé de chaque côté d'un rendez-vous. */
    gap_minutes: number;
    /** Plafond de rendez-vous pris dans cette plage, ce jour-là. */
    max_per_day?: number | null;
    /** Les agents qui tiennent cette plage. Vide, personne ne la tient. */
    host_ids: number[];
};
/** Un agent candidat. */
export type BookingHost = {
    id: number;
    /**
     * Combien de rendez-vous il peut tenir en même temps. 1 par défaut.
     *
     * Absent ou inférieur à 1, on retombe sur 1 : un agent dont la capacité
     * n'aurait pas été chargée doit se comporter comme avant, jamais comme un
     * agent sans limite.
     */
    capacity?: number;
};
/**
 * Un blocage sur un jour local donné.
 *
 * `host_id: null` bloque tout le monde (jour férié, fermeture du projet).
 * `start_minute: null` bloque la journée entière — un jour off ne peut pas être
 * défait par une ligne partielle restée là.
 */
export type BookingBlock = {
    host_id: number | null;
    /** `YYYY-MM-DD` local. */
    day: string;
    start_minute: number | null;
    end_minute: number | null;
};
/** Un rendez-vous déjà pris. Millisecondes epoch, intervalle semi-ouvert. */
export type BusyInterval = {
    host_id: number;
    start: number;
    end: number;
    /**
     * Si ce rendez-vous compte dans le plafond journalier du scheduler.
     *
     * Il est vrai pour les rendez-vous du même type et faux pour les autres :
     * un agent qui fait une visite n'est plus libre à cette heure-là, mais ça ne
     * consomme pas un des dix handovers autorisés ce jour-là. Le plafond de
     * l'agent, lui, compte tout — sa journée est pleine quoi qu'il y fasse.
     */
    counts_for_cap: boolean;
};
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
    leadTimeDays: number;
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
    leadTimeWorkingDays?: boolean;
    /** Les jours sautés en jours ouvrés (`Date.getDay()`). Défaut : `DEFAULT_WEEKEND`. */
    weekend?: number[];
    horizonDays: number;
    /** Premier jour local `YYYY-MM-DD` où une visite peut tomber. `null` = dès aujourd'hui. */
    visitsFrom: string | null;
    /** Dernier jour local `YYYY-MM-DD` où une visite peut tomber. `null` = sans fin. */
    visitsTo: string | null;
};
export type Slot = {
    /** Instant ISO. */
    start: string;
    end: string;
    /** Jour local `YYYY-MM-DD`, pour regrouper côté client sans reconvertir. */
    day: string;
    /** `HH:MM` local. */
    label: string;
    /** Longueur de ce créneau : elle dépend de la plage qui l'a produit. */
    duration_minutes: number;
    /** Tous les agents libres pour ce créneau, dans l'ordre où ils ont été fournis. */
    host_ids: number[];
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
    seats_free: number;
    seats_total: number;
};
export type ComputeSlotsInput = {
    tz: string;
    hosts: BookingHost[];
    windows: BookingWindow[];
    blocks: BookingBlock[];
    busy: BusyInterval[];
    policy: SlotPolicy;
    from: Date;
    to: Date;
    now: Date;
    /** S'arrêter après ce nombre d'heures de début distinctes. */
    limit?: number;
};
type Window = {
    start: number;
    end: number;
};
/** Un morceau de plage réellement ouvert, avec la plage dont il vient. */
export type OpenSegment = Window & {
    window: BookingWindow;
};
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
export declare function openSegments(hostId: number, weekday: number, dayKey: string, windows: BookingWindow[], blocks: BookingBlock[]): OpenSegment[];
/**
 * @deprecated Gardé pour les appels qui n'ont que faire des réglages par plage.
 * Fusionne comme avant ; préférer `openSegments`.
 */
export declare function dayWindows(hostId: number, weekday: number, dayKey: string, windows: BookingWindow[], blocks: BookingBlock[]): Window[];
/**
 * Le premier instant qu'un préavis laisse prendre.
 *
 * En jours calendaires, c'est un simple décalage de 24 heures par jour depuis
 * maintenant. En jours ouvrés, on avance de jour local en jour local en sautant
 * le week-end, et la journée atteinte s'ouvre dès minuit.
 */
export declare function leadTimeFloor(now: Date, leadTimeDays: number, workingDays: boolean, tz: string, weekend?: number[]): number;
/**
 * Toutes les heures de début qu'au moins un agent peut prendre, entre `from` et `to`.
 *
 * On parcourt des jours locaux plutôt que des instants, pour qu'une fenêtre reste
 * attachée au jour pour lequel elle a été écrite, et on garde l'agenda de chaque
 * agent trié une fois pour que le test de chevauchement soit une recherche
 * dichotomique plutôt qu'un parcours complet.
 */
export declare function computeSlots(input: ComputeSlotsInput): Slot[];
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
export declare function openHostsAt(input: Omit<ComputeSlotsInput, 'from' | 'to' | 'limit'>, start: Date): {
    host_ids: number[];
    duration_minutes: number;
};
export {};
