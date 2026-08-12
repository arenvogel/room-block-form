// Run: node tests/calc.test.js
const { nightlyRate, nightsBetween, roomTotal, formatMoney } = require("../calc.js");

let failures = 0;
function eq(actual, expected, label) {
  const pass = actual === expected;
  if (!pass) {
    failures++;
    console.error("FAIL " + label + " — expected " + expected + ", got " + actual);
  } else {
    console.log("ok   " + label);
  }
}

// Adult-only rates (updated block rates from Dani's 8/12 email)
eq(nightlyRate(1, 0), 279, "1 adult = $279");
eq(nightlyRate(2, 0), 379, "2 adults = $379");
eq(nightlyRate(3, 0), 508, "3 adults = $508");
eq(nightlyRate(4, 0), 637, "4 adults = $637");

// Child combinations (adult rate + $105 per child)
eq(nightlyRate(1, 1), 384, "1 adult + 1 child = $384");
eq(nightlyRate(1, 2), 489, "1 adult + 2 children = $489");
eq(nightlyRate(1, 3), 594, "1 adult + 3 children = $594");
eq(nightlyRate(2, 1), 484, "2 adults + 1 child = $484");
eq(nightlyRate(2, 2), 589, "2 adults + 2 children = $589");
eq(nightlyRate(3, 1), 613, "3 adults + 1 child = $613");

// Occupancy limits
eq(nightlyRate(4, 1), null, "4 adults + 1 child exceeds max occupancy");
eq(nightlyRate(2, 3), null, "2 adults + 3 children exceeds max occupancy");
eq(nightlyRate(0, 2), null, "0 adults is invalid");
eq(nightlyRate(5, 0), null, "5 adults is invalid");
eq(nightlyRate(-1, 0), null, "negative adults is invalid");
eq(nightlyRate(2, -1), null, "negative children is invalid");
eq(nightlyRate(2.5, 0), null, "non-integer adults is invalid");
eq(nightlyRate("2", 0), null, "string adults is invalid");

// Nights
eq(nightsBetween("2027-02-04", "2027-02-07"), 3, "Feb 4 to Feb 7 = 3 nights");
eq(nightsBetween("2027-02-04", "2027-02-05"), 1, "one night");
eq(nightsBetween("2027-02-28", "2027-03-02"), 2, "month boundary");
eq(nightsBetween("2027-12-31", "2028-01-02"), 2, "year boundary");
eq(nightsBetween("2027-02-04", "2027-02-04"), null, "same-day is invalid");
eq(nightsBetween("2027-02-07", "2027-02-04"), null, "checkout before checkin is invalid");
eq(nightsBetween("", "2027-02-07"), null, "missing checkin is invalid");
eq(nightsBetween("2027-02-04", ""), null, "missing checkout is invalid");
eq(nightsBetween("garbage", "2027-02-07"), null, "malformed date is invalid");
// DST boundary (US spring forward 2027-03-14): UTC math must still give whole nights
eq(nightsBetween("2027-03-13", "2027-03-15"), 2, "DST spring-forward boundary");

// Room totals (example from the email: 3 nights x $379 = $1,137)
eq(roomTotal(2, 0, "2027-02-04", "2027-02-07"), 1137, "email example: $1,137");
eq(roomTotal(2, 2, "2027-02-04", "2027-02-06"), 1178, "2A+2C, 2 nights = $1,178");
eq(roomTotal(1, 1, "2027-02-04", "2027-02-07"), 1152, "1A+1C, 3 nights = $1,152");
eq(roomTotal(4, 1, "2027-02-04", "2027-02-07"), null, "invalid occupancy yields null total");
eq(roomTotal(2, 0, "2027-02-07", "2027-02-04"), null, "invalid dates yield null total");

// Money formatting
eq(formatMoney(1137), "$1,137", "whole dollars, comma grouping");
eq(formatMoney(367.5), "$367.50", "cents shown with two decimals");
eq(formatMoney(1102.5), "$1,102.50", "grouping + cents");
eq(formatMoney(0), "$0", "zero");

if (failures) {
  console.error("\n" + failures + " test(s) failed");
  process.exit(1);
}
console.log("\nAll tests passed");
