// Rolling weekly sale: always ends at midnight UK time at the end of the coming Sunday
// (i.e. 00:00 Monday, Europe/London). On a Sunday it ends that night.
const londonParts = (date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
};
const londonOffsetMs = (date) => {
  const p = londonParts(date);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
};
export const saleEndsAt = (now = new Date()) => {
  const p = londonParts(now);
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  const days = ((8 - dow) % 7) || 7;
  const target = Date.UTC(p.y, p.m - 1, p.d + days);
  let utc = target - londonOffsetMs(new Date(target));
  utc = target - londonOffsetMs(new Date(utc));
  return new Date(utc).toISOString();
};
