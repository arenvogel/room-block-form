// Pure pricing/date logic. No DOM access — also loaded by Node for tests
// and mirrored in apps-script/Code.gs for server-side recalculation.

const RATES_BY_ADULTS = { 1: 279, 2: 379, 3: 499, 4: 625 };
const CHILD_RATE_PER_NIGHT = 88.5;
const MAX_OCCUPANCY = 4;

// Returns the nightly rate for a room, or null if the occupancy is invalid.
function nightlyRate(adults, children) {
  if (!Number.isInteger(adults) || !Number.isInteger(children)) return null;
  if (adults < 1 || children < 0) return null;
  if (adults + children > MAX_OCCUPANCY) return null;
  return RATES_BY_ADULTS[adults] + CHILD_RATE_PER_NIGHT * children;
}

// Nights between two "YYYY-MM-DD" strings, or null if invalid/non-positive.
function nightsBetween(checkIn, checkOut) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(checkIn || "") || !re.test(checkOut || "")) return null;
  const inMs = Date.parse(checkIn + "T00:00:00Z");
  const outMs = Date.parse(checkOut + "T00:00:00Z");
  if (Number.isNaN(inMs) || Number.isNaN(outMs)) return null;
  const nights = Math.round((outMs - inMs) / 86400000);
  return nights > 0 ? nights : null;
}

// Total for one room, or null if any input is invalid.
function roomTotal(adults, children, checkIn, checkOut) {
  const rate = nightlyRate(adults, children);
  const nights = nightsBetween(checkIn, checkOut);
  if (rate === null || nights === null) return null;
  return rate * nights;
}

// "$1,137" for whole amounts, "$556.50" otherwise.
function formatMoney(amount) {
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return "$" + amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RATES_BY_ADULTS, CHILD_RATE_PER_NIGHT, MAX_OCCUPANCY,
    nightlyRate, nightsBetween, roomTotal, formatMoney,
  };
}
