# Room Block Reservation Form

Static reservation form (GitHub Pages) + Google Apps Script backend + Google Sheet.
Guests pick rooms, occupancy, and dates; the form calculates rates live and shows a
Total Amount Due. Submissions land as rows in a Google Sheet you share with the
booking agent, with optional email notifications.

## Rates (hardcoded in `calc.js` and `apps-script/Code.gs`)
- 1 adult $279 / 2 adults $379 / 3 adults $508 / 4 adults $637 per night
- Children (2-12): +$105 per child per night
- Max 4 guests per room
- King vs. Queens preference is captured but does not affect price

The server recalculates all totals; client math is never trusted.

## Square checkout
Set `SQUARE_ACCESS_TOKEN` (production) and `SQUARE_LOCATION_ID` at the top of
`apps-script/Code.gs` (never in this repo — the repo is public), then deploy a
new version. The backend then creates a per-reservation Square Payment Link
with the exact total and the confirmation screen shows "Continue to Payment".
With the credentials unset, guests get the "we'll follow up" message instead.

## Setup

### 1. Google Sheet + Apps Script (the backend)
1. Create a new Google Sheet named e.g. "Room Block Reservations".
2. Extensions → Apps Script. Delete the stub, paste in `apps-script/Code.gs`.
3. Set `NOTIFY_EMAILS` at the top (e.g. Dani's email) or leave `""` for no emails.
4. Deploy → New deployment → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorize when prompted, copy the **/exec** URL.
6. Share the Sheet (view access) with the booking agent.

### 2. The site
1. In `config.js` set:
   - `ENDPOINT_URL` to the /exec URL from above
   - `PAYMENT_URL` when the travel agent's payment link is confirmed (leave `""`
     to show the "we'll follow up with payment instructions" message instead)
   - `EVENT_NAME`, `HOTEL_NAME`, and `STAY_MIN_DATE`/`STAY_MAX_DATE` to the
     room block window (e.g. `"2027-02-03"` / `"2027-02-08"`)
2. Push this folder to a GitHub repo, enable Pages (Settings → Pages →
   Deploy from branch → main, root).
3. Share the Pages URL.

Note: GitHub Pages on a free account requires the repo to be **public** (the code
and rate table are visible; guest data never touches the repo). Use Netlify if
the repo must stay private.

## Local preview
Open `index.html` directly, or `python3 -m http.server` in this folder.
Submissions fail politely until `ENDPOINT_URL` is set.

## Tests
`node tests/calc.test.js` — covers every rate combination from the spec,
night math, occupancy limits, and invalid-input handling.

## Files
- `index.html` / `styles.css` / `app.js` — the form UI and behavior
- `calc.js` — pure pricing/date functions (shared by tests)
- `config.js` — all deployment settings
- `apps-script/Code.gs` — backend: validates, recalculates, writes the Sheet, emails
