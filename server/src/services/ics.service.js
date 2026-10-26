/**
 * Generates an iCalendar (RFC 5545) feed of daily coach reminders. Phones
 * import it into their calendar app, which delivers the notifications even
 * when the web app is closed (a browser page cannot do that reliably on iOS).
 */
const pad = (n) => String(n).padStart(2, '0');
const escape = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function buildReminderCalendar({ reminders, startDate, days = 28, timezone = 'Asia/Kolkata', appUrl }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = startDate.replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitCoach//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:FitCoach reminders',
  ];
  reminders.forEach((r, i) => {
    const [h, m] = r.time.split(':').map(Number);
    lines.push(
      'BEGIN:VEVENT',
      `UID:fitcoach-${start}-${i}@fitcoach.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${timezone}:${start}T${pad(h)}${pad(m)}00`,
      'DURATION:PT10M',
      `RRULE:FREQ=DAILY;COUNT=${days}`,
      `SUMMARY:${escape(`FitCoach: ${r.label}`)}`,
      `DESCRIPTION:${escape(`Open FitCoach and log it${appUrl ? `: ${appUrl}` : ''}`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(r.label)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
