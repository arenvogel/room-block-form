// Form behavior: dynamic room sections, live pricing, validation, submit.
(function () {
  "use strict";

  const form = document.getElementById("reservation-form");
  const roomCountSelect = document.getElementById("room-count");
  const sameDatesFieldset = document.getElementById("same-dates-fieldset");
  const sharedDatesBlock = document.getElementById("shared-dates");
  const sharedCheckIn = document.getElementById("shared-check-in");
  const sharedCheckOut = document.getElementById("shared-check-out");
  const roomCardsContainer = document.getElementById("room-cards");
  const roomTemplate = document.getElementById("room-card-template");
  const summaryRooms = document.getElementById("summary-rooms");
  const grandTotalEl = document.getElementById("grand-total");
  const errorBox = document.getElementById("form-errors");
  const submitBtn = document.getElementById("submit-btn");

  // ---- Header text from config ----
  if (CONFIG.EVENT_NAME) document.getElementById("event-name").textContent = CONFIG.EVENT_NAME;
  if (CONFIG.HOTEL_NAME) {
    const hotelEl = document.getElementById("hotel-name");
    hotelEl.textContent = CONFIG.HOTEL_NAME;
    hotelEl.hidden = false;
  }

  // ---- Room count options ----
  for (let i = 1; i <= CONFIG.MAX_ROOMS; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = i === 1 ? "1 room" : i + " rooms";
    roomCountSelect.appendChild(opt);
  }

  function addDaysIso(iso, days) {
    return new Date(Date.parse(iso + "T00:00:00Z") + days * 86400000)
      .toISOString().slice(0, 10);
  }

  // Constrain pickers to the room block window. A check-in on the window's
  // last day (or a check-out on its first) can never form a valid stay, so
  // each role gets a one-day-tighter bound.
  function applyDateBounds(input, role) {
    if (CONFIG.STAY_MIN_DATE) {
      input.min = role === "out" ? addDaysIso(CONFIG.STAY_MIN_DATE, 1) : CONFIG.STAY_MIN_DATE;
    }
    if (CONFIG.STAY_MAX_DATE) {
      input.max = role === "in" ? addDaysIso(CONFIG.STAY_MAX_DATE, -1) : CONFIG.STAY_MAX_DATE;
    }
  }
  function applyDefaultDates(checkIn, checkOut) {
    if (CONFIG.DEFAULT_CHECK_IN) checkIn.value = CONFIG.DEFAULT_CHECK_IN;
    if (CONFIG.DEFAULT_CHECK_OUT) checkOut.value = CONFIG.DEFAULT_CHECK_OUT;
  }

  // Copy a date across a mode switch unless the destination was deliberately
  // edited (an untouched field is empty or still holds the prefilled default).
  function carryDate(srcEl, destEl, defaultValue) {
    if (!srcEl.value) return;
    if (!destEl.value || destEl.value === defaultValue) destEl.value = srcEl.value;
  }
  applyDateBounds(sharedCheckIn, "in");
  applyDateBounds(sharedCheckOut, "out");
  applyDefaultDates(sharedCheckIn, sharedCheckOut);

  // ---- Room cards ----
  const roomCards = [];

  function buildOptions(select, from, to, keepValue) {
    const prev = keepValue !== undefined ? keepValue : select.value;
    select.innerHTML = "";
    for (let i = from; i <= to; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      select.appendChild(opt);
    }
    if (prev !== "" && Number(prev) >= from && Number(prev) <= to) select.value = prev;
  }

  function buildGuestNameInputs(card) {
    const adults = Number(card.querySelector(".adults-select").value);
    const children = Number(card.querySelector(".children-select").value);
    const container = card.querySelector(".guest-name-inputs");
    const existing = Array.from(container.querySelectorAll("input")).map((el) => el.value);
    container.innerHTML = "";
    const total = adults + children;
    for (let i = 0; i < total; i++) {
      const input = document.createElement("input");
      input.type = "text";
      input.required = true;
      input.autocomplete = "off";
      input.placeholder = i < adults ? "Adult " + (i + 1) + " full name" : "Child " + (i - adults + 1) + " full name";
      if (existing[i]) input.value = existing[i];
      input.addEventListener("input", updatePricing);
      container.appendChild(input);
    }
  }

  function createRoomCard(index) {
    const card = roomTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".room-title").textContent = "Room " + (index + 1);

    // Unique radio group per room
    card.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.name = "roomType-" + index;
      radio.required = true;
      radio.addEventListener("change", updatePricing);
    });

    const adultsSelect = card.querySelector(".adults-select");
    const childrenSelect = card.querySelector(".children-select");
    buildOptions(adultsSelect, 1, 4, "2");
    buildOptions(childrenSelect, 0, 4 - Number(adultsSelect.value), "0");

    const occupancyNote = card.querySelector(".occupancy-note");
    adultsSelect.addEventListener("change", () => {
      // Max occupancy is 4: shrink the children options to what still fits.
      const prevChildren = Number(childrenSelect.value);
      const maxChildren = 4 - Number(adultsSelect.value);
      buildOptions(childrenSelect, 0, maxChildren);
      if (prevChildren > maxChildren) {
        // Clamp instead of silently resetting to 0, and say so.
        childrenSelect.value = String(maxChildren);
        occupancyNote.textContent =
          "Children adjusted to " + maxChildren +
          " to stay within the 4-guest room limit. Please double-check the guest names below.";
        occupancyNote.hidden = false;
      } else {
        occupancyNote.hidden = true;
      }
      buildGuestNameInputs(card);
      updatePricing();
    });
    childrenSelect.addEventListener("change", () => {
      occupancyNote.hidden = true;
      buildGuestNameInputs(card);
      updatePricing();
    });

    const checkIn = card.querySelector(".check-in");
    const checkOut = card.querySelector(".check-out");
    applyDateBounds(checkIn, "in");
    applyDateBounds(checkOut, "out");
    applyDefaultDates(checkIn, checkOut);
    [checkIn, checkOut].forEach((el) => el.addEventListener("change", updatePricing));

    buildGuestNameInputs(card);
    return card;
  }

  function syncRoomCards() {
    const count = Number(roomCountSelect.value);
    const wasSingle = roomCards.length === 1;
    const wasShared = roomCards.length > 1 && form.elements.sameDates.value === "yes";
    while (roomCards.length < count) {
      const card = createRoomCard(roomCards.length);
      roomCards.push(card);
      roomCardsContainer.appendChild(card);
    }
    while (roomCards.length > count) {
      roomCards.pop().remove();
    }
    // Going from 1 room to several defaults to shared dates: carry the dates
    // already typed on room 1 into the shared fields so nothing is retyped.
    if (wasSingle && count > 1 && form.elements.sameDates.value === "yes") {
      carryDate(roomCards[0].querySelector(".check-in"), sharedCheckIn, CONFIG.DEFAULT_CHECK_IN);
      carryDate(roomCards[0].querySelector(".check-out"), sharedCheckOut, CONFIG.DEFAULT_CHECK_OUT);
    }
    // And the reverse: dropping back to 1 room leaves per-room dates in
    // charge, so carry the shared dates into room 1.
    if (wasShared && count === 1) {
      carryDate(sharedCheckIn, roomCards[0].querySelector(".check-in"), CONFIG.DEFAULT_CHECK_IN);
      carryDate(sharedCheckOut, roomCards[0].querySelector(".check-out"), CONFIG.DEFAULT_CHECK_OUT);
    }
    syncDatesMode();
    updatePricing();
  }

  function usingSharedDates() {
    const count = Number(roomCountSelect.value);
    if (count === 1) return false; // single room: dates live on the room card
    return form.elements.sameDates.value === "yes";
  }

  function syncDatesMode() {
    const count = Number(roomCountSelect.value);
    const shared = usingSharedDates();
    sameDatesFieldset.hidden = count === 1;
    sharedDatesBlock.hidden = !shared;
    sharedCheckIn.required = shared;
    sharedCheckOut.required = shared;
    roomCards.forEach((card) => {
      const datesRow = card.querySelector(".room-dates");
      datesRow.hidden = shared;
      datesRow.querySelectorAll("input").forEach((el) => (el.required = !shared));
    });
  }

  // ---- Reading state ----
  function readRoom(card, index) {
    const shared = usingSharedDates();
    const typeRadio = card.querySelector('input[type="radio"]:checked');
    const adults = Number(card.querySelector(".adults-select").value);
    const children = Number(card.querySelector(".children-select").value);
    const guestNames = Array.from(card.querySelectorAll(".guest-name-inputs input"))
      .map((el) => el.value.trim());
    const checkIn = shared ? sharedCheckIn.value : card.querySelector(".check-in").value;
    const checkOut = shared ? sharedCheckOut.value : card.querySelector(".check-out").value;
    return {
      roomNumber: index + 1,
      roomType: typeRadio ? typeRadio.value : "",
      adults: adults,
      children: children,
      guestNames: guestNames,
      checkIn: checkIn,
      checkOut: checkOut,
      nights: nightsBetween(checkIn, checkOut),
      nightlyRate: nightlyRate(adults, children),
      total: roomTotal(adults, children, checkIn, checkOut),
    };
  }

  function readRooms() {
    return roomCards.map(readRoom);
  }

  // ---- Live pricing ----
  function describeOccupancy(room) {
    const parts = [room.adults + (room.adults === 1 ? " adult" : " adults")];
    if (room.children > 0) parts.push(room.children + (room.children === 1 ? " child" : " children"));
    return parts.join(" + ");
  }

  function formatDateShort(iso) {
    return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short", day: "numeric", timeZone: "UTC",
    });
  }

  function describeNights(nights) {
    return nights + (nights === 1 ? " night" : " nights");
  }

  function updatePricing() {
    // Keep checkout after checkin in the pickers.
    const bumpMin = (inEl, outEl) => {
      if (inEl.value) {
        const next = new Date(Date.parse(inEl.value + "T00:00:00Z") + 86400000)
          .toISOString().slice(0, 10);
        outEl.min = (CONFIG.STAY_MIN_DATE && CONFIG.STAY_MIN_DATE > next) ? CONFIG.STAY_MIN_DATE : next;
      }
    };
    bumpMin(sharedCheckIn, sharedCheckOut);
    roomCards.forEach((card) =>
      bumpMin(card.querySelector(".check-in"), card.querySelector(".check-out")));

    const rooms = readRooms();
    rooms.forEach((room, i) => {
      const el = roomCards[i].querySelector(".room-pricing");
      if (room.nightlyRate !== null && room.total !== null) {
        el.innerHTML =
          '<span class="rate-line">' + describeOccupancy(room) + " · " +
          formatMoney(room.nightlyRate) + "/night × " + room.nights +
          (room.nights === 1 ? " night" : " nights") + "</span>" +
          '<span class="room-total">' + formatMoney(room.total) + "</span>";
      } else if (room.nightlyRate !== null) {
        el.innerHTML =
          '<span class="rate-line">' + describeOccupancy(room) + " · " +
          formatMoney(room.nightlyRate) + "/night</span>" +
          '<span class="room-total muted">select dates</span>';
      } else {
        el.innerHTML = '<span class="rate-line">—</span>';
      }
    });

    // Summary: per the spec, each room shows type, guest names, occupancy,
    // dates, nights, nightly rate, and room total. Built with textContent
    // since guest names are user input.
    summaryRooms.innerHTML = "";
    let grandTotal = 0;
    let complete = rooms.length > 0;
    rooms.forEach((room) => {
      if (room.total === null) complete = false;
      else grandTotal += room.total;

      const row = document.createElement("div");
      row.className = "summary-row";
      const left = document.createElement("div");

      const title = document.createElement("strong");
      title.textContent = "Room " + room.roomNumber +
        " · " + (room.roomType || "room type not selected");
      left.appendChild(title);

      const addDetail = (text) => {
        const span = document.createElement("span");
        span.className = "summary-detail";
        span.textContent = text;
        left.appendChild(span);
      };

      const names = room.guestNames.filter(Boolean);
      addDetail(describeOccupancy(room) + (names.length ? ": " + names.join(", ") : ""));
      if (room.nights) {
        addDetail(formatDateShort(room.checkIn) + " to " + formatDateShort(room.checkOut) +
          " · " + describeNights(room.nights));
        if (room.nightlyRate !== null) {
          addDetail(formatMoney(room.nightlyRate) + "/night × " + room.nights);
        }
      } else {
        addDetail("Dates not set");
      }

      const amount = document.createElement("span");
      amount.className = "summary-amount";
      amount.textContent = room.total !== null ? formatMoney(room.total) : "—";

      row.appendChild(left);
      row.appendChild(amount);
      summaryRooms.appendChild(row);
    });
    grandTotalEl.textContent = complete ? formatMoney(grandTotal) : "—";
  }

  // ---- Validation ----
  function validate(rooms) {
    const errors = [];
    rooms.forEach((room) => {
      const label = "Room " + room.roomNumber;
      if (!room.roomType) errors.push(label + ": choose a room type.");
      if (room.nightlyRate === null) errors.push(label + ": maximum 4 guests per room.");
      if (room.guestNames.some((n) => !n)) errors.push(label + ": enter a name for every guest.");
      if (!room.checkIn || !room.checkOut) {
        errors.push(label + ": select check-in and check-out dates.");
      } else if (room.nights === null) {
        errors.push(label + ": check-out must be after check-in.");
      }
    });
    return errors;
  }

  // ---- Submit ----
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const rooms = readRooms();
    const errors = validate(rooms);
    if (errors.length) {
      errorBox.innerHTML = errors.map((e) => "<div>" + e + "</div>").join("");
      errorBox.hidden = false;
      errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const payload = {
      // Idempotency key: the server dedupes on this, so the automatic retry
      // below can never double-book a reservation.
      clientRef: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10),
      submittedAt: new Date().toISOString(),
      primaryGuest: {
        firstName: form.elements.firstName.value.trim(),
        lastName: form.elements.lastName.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
      },
      rooms: rooms,
      totalDue: rooms.reduce((sum, r) => sum + r.total, 0),
    };

    if (!CONFIG.ENDPOINT_URL) {
      errorBox.innerHTML = "<div>This form isn't connected yet. Please try again later or contact us directly.</div>";
      errorBox.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    const postOnce = async () => {
      // 30s cap so a stalled network shows an error instead of hanging.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(CONFIG.ENDPOINT_URL, {
          method: "POST",
          // text/plain avoids a CORS preflight, which Apps Script can't answer.
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      let result;
      try {
        result = await postOnce();
      } catch (netErr) {
        // Network-level failure (timeout, proxy, dropped connection): the
        // server may not have seen the request at all, so one retry is safe
        // enough and rescues transient failures. Server rejections
        // (result.ok === false) are never retried.
        result = await postOnce();
      }
      if (!result.ok) throw new Error(result.error || "Submission failed");
      showConfirmation(
        result.totalDue !== undefined ? result.totalDue : payload.totalDue,
        result.paymentUrl || ""
      );
    } catch (err) {
      errorBox.innerHTML = "<div>Your reservation could not be submitted (a network or firewall issue may be blocking it). Please try again, ideally from a different network or browser. If it keeps failing, contact us directly and we'll confirm whether your request came through.</div>";
      errorBox.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit reservation request";
    }
  });

  function showConfirmation(totalDue, paymentUrl) {
    form.hidden = true;
    const confirmation = document.getElementById("confirmation");
    document.getElementById("confirm-total").textContent = formatMoney(totalDue);
    const payLink = document.getElementById("payment-link");
    const confirmText = document.getElementById("confirm-text");
    const footnote = document.getElementById("confirm-footnote");
    if (paymentUrl) {
      // Per-reservation Square checkout with the exact total prepopulated.
      confirmText.textContent = "Thank you! Your reservation request has been recorded. Complete your payment below to finalize it.";
      payLink.href = paymentUrl;
      payLink.textContent = "Continue to Payment";
      payLink.hidden = false;
      footnote.textContent = "Your checkout total is prefilled to match the amount above. Card, Apple Pay, and Google Pay are accepted.";
    } else if (CONFIG.PAYMENT_URL) {
      confirmText.textContent = "Thank you! Your reservation request has been recorded. Please complete payment for the exact amount below.";
      payLink.href = CONFIG.PAYMENT_URL;
      payLink.textContent = "Continue to Payment";
      payLink.hidden = false;
      footnote.textContent = "Enter the exact Total Amount Due shown above when paying.";
    } else {
      confirmText.textContent = "Thank you! Your reservation request has been recorded. We'll follow up by email with your total and payment instructions.";
    }
    confirmation.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Wire up top-level controls ----
  roomCountSelect.addEventListener("change", syncRoomCards);
  Array.from(form.elements.sameDates).forEach((radio) =>
    radio.addEventListener("change", () => {
      // Carry dates across the mode switch so nothing has to be retyped.
      if (form.elements.sameDates.value === "no") {
        roomCards.forEach((card) => {
          carryDate(sharedCheckIn, card.querySelector(".check-in"), CONFIG.DEFAULT_CHECK_IN);
          carryDate(sharedCheckOut, card.querySelector(".check-out"), CONFIG.DEFAULT_CHECK_OUT);
        });
      } else if (roomCards.length) {
        carryDate(roomCards[0].querySelector(".check-in"), sharedCheckIn, CONFIG.DEFAULT_CHECK_IN);
        carryDate(roomCards[0].querySelector(".check-out"), sharedCheckOut, CONFIG.DEFAULT_CHECK_OUT);
      }
      syncDatesMode();
      updatePricing();
    }));
  [sharedCheckIn, sharedCheckOut].forEach((el) => el.addEventListener("change", updatePricing));

  // ---- Init ----
  roomCountSelect.value = "1";
  syncRoomCards();
})();
