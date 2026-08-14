// ---- Site configuration ----
// Edit these values, then redeploy (git push). No other files need changes.

const CONFIG = {
  // Displayed at the top of the form.
  EVENT_NAME: "Dani & Cam's Wedding Room Block",
  HOTEL_NAME: "Lopesan Caoba Lagoon | Punta Cana",

  // Google Apps Script web app URL (ends in /exec). REQUIRED before go-live.
  ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbya-LX1QxBh6a3VlhBAXPYTBKtl1Sb2EDf2dLfZSty1_ztlGh6LXC0rHns2ro2KSTbz/exec",

  // Payment link (Option A). If set, it is shown on the confirmation screen
  // with the calculated total. If empty, guests see the Option B message
  // ("we'll follow up with your total and payment instructions").
  PAYMENT_URL: "",

  // Allowed stay window (the room block dates). "YYYY-MM-DD" or "" for no limit.
  // STAY_MAX_DATE is the last allowed CHECK-OUT day; the last bookable night
  // is the day before it (Feb 11 per Dani's 8/12 email).
  STAY_MIN_DATE: "2027-02-02",
  STAY_MAX_DATE: "2027-02-12",

  // Dates prefilled in every date field (guests can change them). "" disables.
  DEFAULT_CHECK_IN: "2027-02-04",
  DEFAULT_CHECK_OUT: "2027-02-07",

  // Maximum rooms one person can request.
  MAX_ROOMS: 5,
};
