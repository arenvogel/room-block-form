/**
 * Room Block Reservation — Google Apps Script backend.
 *
 * Setup (once):
 * 1. Create a Google Sheet (this is where reservations land).
 * 2. Extensions → Apps Script, paste this file, set NOTIFY_EMAILS below.
 * 3. Deploy → New deployment → Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Copy the /exec URL into ENDPOINT_URL in the site's config.js.
 *
 * Each submitted room becomes one row, grouped by a shared Reservation ID.
 * Rates are recalculated server-side; the client's math is never trusted.
 */

// Email address(es) to notify on each submission. Comma-separated. "" disables.
const NOTIFY_EMAILS = "";

// Square checkout. Paste the PRODUCTION access token and location ID here
// (never into the public website repo). Leave both "" to disable — guests
// then see the "we'll follow up with payment instructions" message.
const SQUARE_ACCESS_TOKEN = "";
const SQUARE_LOCATION_ID = "";
const SQUARE_API_BASE = "https://connect.squareup.com"; // sandbox: https://connect.squareupsandbox.com

const SHEET_NAME = "Reservations";

// Must match calc.js on the site.
const RATES_BY_ADULTS = { 1: 279, 2: 379, 3: 508, 4: 637 };
const CHILD_RATE_PER_NIGHT = 105;
const MAX_OCCUPANCY = 4;

const HEADERS = [
  "Reservation ID", "Submitted At", "First Name", "Last Name", "Email", "Phone",
  "Room #", "Room Type", "Adults", "Children", "Guest Names",
  "Check-in", "Check-out", "Nights", "Nightly Rate", "Room Total",
  "Reservation Total",
];

function nightlyRate(adults, children) {
  if (!Number.isInteger(adults) || !Number.isInteger(children)) return null;
  if (adults < 1 || children < 0) return null;
  if (adults + children > MAX_OCCUPANCY) return null;
  return RATES_BY_ADULTS[adults] + CHILD_RATE_PER_NIGHT * children;
}

function nightsBetween(checkIn, checkOut) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(checkIn || "") || !re.test(checkOut || "")) return null;
  const nights = Math.round(
    (Date.parse(checkOut + "T00:00:00Z") - Date.parse(checkIn + "T00:00:00Z")) / 86400000
  );
  return nights > 0 ? nights : null;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const guest = data.primaryGuest || {};
    const rooms = data.rooms || [];

    if (!guest.firstName || !guest.lastName || !guest.email || !guest.phone) {
      return jsonResponse({ ok: false, error: "Missing contact information." });
    }
    if (!Array.isArray(rooms) || rooms.length < 1 || rooms.length > 10) {
      return jsonResponse({ ok: false, error: "Invalid number of rooms." });
    }

    // Recalculate every room server-side.
    const computed = [];
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const adults = Number(room.adults);
      const children = Number(room.children);
      const rate = nightlyRate(adults, children);
      const nights = nightsBetween(room.checkIn, room.checkOut);
      const names = Array.isArray(room.guestNames)
        ? room.guestNames.map(String).map((s) => s.trim()).filter(Boolean)
        : [];
      if (rate === null) return jsonResponse({ ok: false, error: "Room " + (i + 1) + ": invalid occupancy." });
      if (nights === null) return jsonResponse({ ok: false, error: "Room " + (i + 1) + ": invalid dates." });
      if (names.length !== adults + children) {
        return jsonResponse({ ok: false, error: "Room " + (i + 1) + ": a name is required for every guest." });
      }
      computed.push({
        roomNumber: i + 1,
        roomType: String(room.roomType || ""),
        adults: adults,
        children: children,
        guestNames: names,
        checkIn: room.checkIn,
        checkOut: room.checkOut,
        nights: nights,
        rate: rate,
        total: rate * nights,
      });
    }
    const totalDue = computed.reduce(function (sum, r) { return sum + r.total; }, 0);

    // Append rows (one per room). Lock so concurrent submissions can't
    // compute the same start row and overwrite each other.
    const reservationId = "RB-" + Utilities.formatDate(new Date(), "America/New_York", "yyyyMMdd-HHmmss") +
      "-" + Math.floor(Math.random() * 900 + 100);
    const submittedAt = Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd HH:mm");
    const rows = computed.map(function (r) {
      return [
        reservationId, submittedAt,
        guest.firstName, guest.lastName, guest.email, guest.phone,
        r.roomNumber, r.roomType, r.adults, r.children, r.guestNames.join(", "),
        r.checkIn, r.checkOut, r.nights, r.rate, r.total,
        totalDue,
      ];
    });
    // The client retries on network failure, so dedupe on its idempotency
    // key: if this exact submission already landed, return the original
    // result instead of appending duplicate rows. Cache check and append
    // share the lock so a concurrent retry can't slip between them.
    const clientRef = String(data.clientRef || "");
    const cache = CacheService.getScriptCache();
    const cacheKey = "res-" + clientRef;
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (clientRef) {
        const previous = cache.get(cacheKey);
        if (previous) return jsonResponse(JSON.parse(previous));
      }
      const sheet = getSheet_();
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
      // Provisional dedupe entry BEFORE releasing the lock, so a retry that
      // lands while the Square call below is in flight can't re-append rows.
      if (clientRef) {
        cache.put(cacheKey, JSON.stringify({
          ok: true, reservationId: reservationId, totalDue: totalDue, paymentUrl: "",
        }), 21600);
      }
    } finally {
      lock.releaseLock();
    }

    // Square checkout link for the exact total. Square's own idempotency key
    // (the reservation ID) means even a duplicate call yields the same link.
    // A Square failure must not fail the persisted reservation: the guest
    // then simply gets the follow-up-by-email message.
    let paymentUrl = "";
    if (SQUARE_ACCESS_TOKEN && SQUARE_LOCATION_ID) {
      try {
        paymentUrl = createSquarePaymentLink_(reservationId, guest, totalDue);
      } catch (sqErr) {
        console.error("Square payment link failed: " + sqErr.message);
      }
    }

    const responseBody = {
      ok: true, reservationId: reservationId, totalDue: totalDue, paymentUrl: paymentUrl,
    };
    if (clientRef) {
      cache.put(cacheKey, JSON.stringify(responseBody), 21600);
    }

    // The reservation is persisted; a notification failure must not fail the
    // request (a retry would append duplicate rows).
    if (NOTIFY_EMAILS) {
      try {
        sendNotification_(reservationId, guest, computed, totalDue, paymentUrl);
      } catch (mailErr) {
        console.error("Notification email failed: " + mailErr.message);
      }
    }

    return jsonResponse(responseBody);
  } catch (err) {
    return jsonResponse({ ok: false, error: "Server error: " + err.message });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Creates a Square-hosted checkout page for the exact reservation total and
// returns its URL. Card and Apple Pay/Google Pay are handled by Square.
function createSquarePaymentLink_(reservationId, guest, totalDue) {
  const request = {
    idempotency_key: reservationId,
    quick_pay: {
      name: "Room Block Reservation " + reservationId + " - " +
        guest.firstName + " " + guest.lastName,
      price_money: { amount: Math.round(totalDue * 100), currency: "USD" },
      location_id: SQUARE_LOCATION_ID,
    },
    checkout_options: {
      allow_tipping: false,
      ask_for_shipping_address: false,
    },
    pre_populated_data: { buyer_email: guest.email },
  };
  let body = postToSquare_(request);
  // The email prefill is a nicety; Square rejects addresses it considers
  // invalid, and that must not cost the guest their checkout link.
  if (body.errors && JSON.stringify(body.errors).indexOf("buyer_email") !== -1) {
    delete request.pre_populated_data;
    body = postToSquare_(request);
  }
  if (!body.payment_link || !body.payment_link.url) {
    throw new Error("Square API error: " + JSON.stringify(body).slice(0, 300));
  }
  return body.payment_link.url;
}

function postToSquare_(request) {
  const response = UrlFetchApp.fetch(SQUARE_API_BASE + "/v2/online-checkout/payment-links", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + SQUARE_ACCESS_TOKEN },
    payload: JSON.stringify(request),
    muteHttpExceptions: true,
  });
  return JSON.parse(response.getContentText());
}

function money_(amount) {
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return "$" + amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });
}

function sendNotification_(reservationId, guest, rooms, totalDue, paymentUrl) {
  const lines = [
    "New room block reservation: " + reservationId,
    "",
    "Guest: " + guest.firstName + " " + guest.lastName,
    "Email: " + guest.email,
    "Phone: " + guest.phone,
    "",
  ];
  rooms.forEach(function (r) {
    lines.push(
      "Room " + r.roomNumber + ": " + r.roomType + " | " +
      r.adults + " adult(s), " + r.children + " child(ren) | " +
      r.checkIn + " to " + r.checkOut + " (" + r.nights + " nights) | " +
      money_(r.rate) + "/night = " + money_(r.total)
    );
    lines.push("  Guests: " + r.guestNames.join(", "));
  });
  lines.push("");
  lines.push("TOTAL DUE: " + money_(totalDue));
  if (paymentUrl) {
    lines.push("Square checkout link: " + paymentUrl);
  }
  MailApp.sendEmail({
    to: NOTIFY_EMAILS,
    subject: "Room Block Reservation " + reservationId + " - " + guest.firstName + " " + guest.lastName + " (" + money_(totalDue) + ")",
    body: lines.join("\n"),
  });
}
