/**
 * Programobjekt -> .ics (RFC 5545) för export till kalender.
 *
 * Ren funktion: ingen DOM, inget nätverk, ingen klocka. Tidsstämpeln hämtas
 * från programmets `createdAt`, så samma program ger alltid exakt samma fil.
 *
 * Texterna skickas in i stället för att importeras. Logiken ska inte äga
 * svenska strängar — anroparen ger dem, och filen kan därmed exporteras på
 * vilket språk som helst utan att den här modulen ändras.
 */
import type {
  Discipline,
  Intensity,
  IsoDate,
  Program,
  Session,
  SessionPurpose,
  SessionStructure,
  Substitute,
  Week,
} from './types';

/** Texterna exporten behöver. Anroparen äger språket. */
export interface IcsLabels {
  calendarName: string;
  discipline: Record<Discipline, string>;
  purpose: Record<SessionPurpose, string>;
  structure: Record<SessionStructure, string>;
  intensity: Record<Intensity, string>;
  substitute: Record<Substitute, string>;
  race: Record<Discipline, string>;
  openWater: string;
  keySession: string;
  supportingSession: string;
  disclaimer: string;
}

/** Radslut enligt RFC 5545: alltid CRLF, aldrig bara LF. */
const CRLF = '\r\n';

/** Längsta tillåtna rad i oktetter innan den måste vikas. */
const MAX_OCTETS = 75;

/** Domän i UID. Behöver inte existera — den skiljer våra UID från andras. */
const UID_DOMAIN = 'klassikerplaneraren';

/**
 * Serialiserar programmet till en .ics-fil som text.
 *
 * Varje pass blir en heldagshändelse. Vi hittar inte på klockslag: programmet
 * vet vilken dag passet ligger, inte när på dagen användaren tränar. Längden
 * står i rubriken i stället.
 *
 * Loppen blir egna händelser, så att kalendern visar vad allt syftar till.
 */
export function programToIcs(program: Program, labels: IcsLabels): string {
  const stamp = timestamp(program.createdAt);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${UID_DOMAIN}//SV`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(labels.calendarName)}`,
  ];

  for (const week of program.weeks) {
    if (week.raceDate !== undefined) {
      lines.push(...raceEvent(week, week.raceDate, stamp, labels));
    }
    for (const [index, session] of sortedSessions(week).entries()) {
      lines.push(...sessionEvent(week, session, index, stamp, labels));
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join(CRLF) + CRLF;
}

/** Passen i en bestämd ordning, så att UID blir samma vid varje export. */
function sortedSessions(week: Week): Session[] {
  return [...week.sessions].sort(
    (a, b) => a.day - b.day || a.kind.localeCompare(b.kind) || a.hours - b.hours,
  );
}

function sessionEvent(
  week: Week,
  session: Session,
  index: number,
  stamp: string,
  labels: IcsLabels,
): string[] {
  const date = addDays(week.startDate, session.day - 1);
  return [
    'BEGIN:VEVENT',
    // UID bygger på datum och ordning, inte på innehåll. Ändrar användaren sitt
    // program och exporterar igen uppdateras händelsen i stället för att läggas
    // till en gång till.
    `UID:${date}-${index}@${UID_DOMAIN}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
    `SUMMARY:${escapeText(sessionSummary(session, labels))}`,
    `DESCRIPTION:${escapeText(sessionDescription(session, labels))}`,
    'END:VEVENT',
  ];
}

function raceEvent(
  week: Week,
  raceDate: IsoDate,
  stamp: string,
  labels: IcsLabels,
): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${raceDate}-race@${UID_DOMAIN}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(raceDate)}`,
    `DTEND;VALUE=DATE:${compact(addDays(raceDate, 1))}`,
    `SUMMARY:${escapeText(capitalise(labels.race[week.targetRace]))}`,
    `DESCRIPTION:${escapeText(labels.disclaimer)}`,
    'END:VEVENT',
  ];
}

/** Rubriken: gren, längd och vad passet är. */
function sessionSummary(session: Session, labels: IcsLabels): string {
  const discipline =
    session.substitute === undefined
      ? labels.discipline[session.discipline]
      : `${labels.discipline[session.discipline]} (${labels.substitute[session.substitute]})`;

  const where = session.openWater === true ? ` (${labels.openWater})` : '';
  return `${discipline}${where} ${formatHours(session.hours)} · ${labels.purpose[session.purpose]}`;
}

/** Beskrivningen: upplägg, intensitet och hur viktigt passet är. */
function sessionDescription(session: Session, labels: IcsLabels): string {
  const parts = [labels.structure[session.structure]];
  if (session.kind !== 'strength') parts.push(labels.intensity[session.intensity]);
  parts.push(session.priority === 'key' ? labels.keySession : labels.supportingSession);
  parts.push(labels.disclaimer);
  return parts.join('\n');
}

function formatHours(hours: number): string {
  return `${hours.toLocaleString('sv-SE')} h`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `2027-03-07` -> `20270307`, formatet RFC 5545 vill ha. */
function compact(date: IsoDate): string {
  return date.replaceAll('-', '');
}

/**
 * DTSTAMP måste finnas i varje händelse. Vi använder programmets skapandedatum
 * i stället för klockan, så att exporten blir identisk varje gång.
 */
function timestamp(createdAt: IsoDate): string {
  return `${compact(createdAt)}T000000Z`;
}

function addDays(date: IsoDate, days: number): IsoDate {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Escapar tecken som har betydelse i formatet.
 *
 * Ordningen spelar roll: omvänt snedstreck först, annars escapas de snedstreck
 * vi själva lägger till.
 */
export function escapeText(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n');
}

/**
 * Viker rader längre än 75 oktetter.
 *
 * Mätningen sker i oktetter, inte tecken: å, ä och ö tar två byte i UTF-8, och
 * en rad som ser kort ut kan vara för lång. Fortsättningsrader inleds med ett
 * mellanslag, och vi delar aldrig mitt i ett tecken.
 */
export function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_OCTETS) return line;

  const parts: string[] = [];
  let current = '';
  let octets = 0;

  for (const character of line) {
    const size = encoder.encode(character).length;
    // Fortsättningsrader börjar med ett mellanslag som också räknas.
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += character;
    octets += size;
  }
  if (current !== '') parts.push(current);

  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join(CRLF);
}
