// ---- Site configuration ----
// Edit these values, then redeploy (git push). No other files need changes.

const CONFIG = {
  // Displayed at the top of the form.
  EVENT_NAME: "Dani & Cam's Wedding Room Block",
  HOTEL_NAME: "Lopesan Caoba Lagoon | Punta Cana",

  // Google Apps Script web app URL (ends in /exec). REQUIRED before go-live.
  ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbzjYSbGjnLg90xIKZzwGQpGKWxIcGO3KWVIOYIxrdHkgi3PsM59ZCzzHy15em4koNtk/exec",

  // Payment link (Option A). If set, it is shown on the confirmation screen
  // with the calculated total. If empty, guests see the Option B message
  // ("we'll follow up with your total and payment instructions").
  PAYMENT_URL: "",

  // Allowed stay window (the room block dates). "YYYY-MM-DD" or "" for no limit.
  STAY_MIN_DATE: "2027-02-02",
  STAY_MAX_DATE: "2027-02-11",

  // Dates prefilled in every date field (guests can change them). "" disables.
  DEFAULT_CHECK_IN: "2027-02-04",
  DEFAULT_CHECK_OUT: "2027-02-07",

  // Maximum rooms one person can request.
  MAX_ROOMS: 5,
};
