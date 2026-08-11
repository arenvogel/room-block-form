// ---- Site configuration ----
// Edit these values, then redeploy (git push). No other files need changes.

const CONFIG = {
  // Displayed at the top of the form.
  EVENT_NAME: "Vogel Room Block",
  HOTEL_NAME: "", // e.g. "The Grand Hotel" (optional, shown under the title)

  // Google Apps Script web app URL (ends in /exec). REQUIRED before go-live.
  ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbzjYSbGjnLg90xIKZzwGQpGKWxIcGO3KWVIOYIxrdHkgi3PsM59ZCzzHy15em4koNtk/exec",

  // Payment link (Option A). If set, it is shown on the confirmation screen
  // with the calculated total. If empty, guests see the Option B message
  // ("we'll follow up with your total and payment instructions").
  PAYMENT_URL: "",

  // Allowed stay window (the room block dates). "YYYY-MM-DD" or "" for no limit.
  STAY_MIN_DATE: "",
  STAY_MAX_DATE: "",

  // Maximum rooms one person can request.
  MAX_ROOMS: 5,
};
