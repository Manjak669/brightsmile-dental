const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    io.unobserve(entry.target);
  });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 3) * 90}ms`;
  io.observe(el);
});

// ---------- Booking wizard ----------
const OPEN = { 0: [8, 19], 1: [8, 19], 2: [8, 19], 3: [8, 19], 4: [8, 19], 5: [8, 13], 6: null }; // Sun..Sat
const SLOT_TIMES = ["08:00", "09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00"];

// Deterministic "busy" slots so the demo looks realistic but stable
function isBusy(date, time) {
  const [h, m] = time.split(":").map(Number);
  return (date.getDate() * 7 + h * 3 + m / 30) % 5 === 0;
}
function slotsFor(date) {
  const hours = OPEN[date.getDay()];
  if (!hours) return [];
  const now = new Date();
  return SLOT_TIMES.filter((t) => {
    const [h, m] = t.split(":").map(Number);
    if (h < hours[0] || h + m / 60 >= hours[1]) return false;
    const slot = new Date(date); slot.setHours(h, m, 0, 0);
    return slot > now;
  }).map((t) => ({ time: t, busy: isBusy(date, t) }));
}
const fmtDay = (d) => d.toLocaleDateString("en-US", { weekday: "short" });
const fmtLong = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

// Upcoming 10 open days
const days = [];
for (let i = 0; days.length < 10 && i < 21; i++) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
  if (slotsFor(d).some((s) => !s.busy)) days.push(d);
}

// Hero "next free slot"
if (days.length) {
  const first = slotsFor(days[0]).find((s) => !s.busy);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((days[0] - today) / 864e5);
  const label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : fmtLong(days[0]);
  document.getElementById("next-slot").textContent = `${label}, ${first.time}`;
}

const daysEl = document.getElementById("days");
const slotsEl = document.getElementById("slots");
days.forEach((d, i) => {
  const label = document.createElement("label");
  label.className = "day";
  label.innerHTML = `<input type="radio" name="day" value="${i}"><span>${fmtDay(d)}<small>${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}</small></span>`;
  daysEl.append(label);
});
function renderSlots(dayIndex) {
  slotsEl.innerHTML = "";
  slotsFor(days[dayIndex]).forEach((s) => {
    const label = document.createElement("label");
    label.className = "slot";
    label.innerHTML = `<input type="radio" name="time" value="${s.time}" ${s.busy ? "disabled" : ""}><span>${s.time}</span>`;
    if (s.busy) label.title = "Already booked";
    slotsEl.append(label);
  });
}
daysEl.addEventListener("change", (e) => renderSlots(Number(e.target.value)));
if (days.length) { daysEl.querySelector("input").checked = true; renderSlots(0); }

const form = document.getElementById("wizard");
const panels = [...form.querySelectorAll(".panel")];
const stepItems = [...form.querySelectorAll(".steps li")];
const back = document.getElementById("back");
const next = document.getElementById("next");
let step = 1;

function show(n) {
  step = n;
  panels.forEach((p) => (p.hidden = Number(p.dataset.step) !== n));
  stepItems.forEach((li, i) => {
    li.classList.toggle("is-current", i + 1 === n);
    li.classList.toggle("is-done", i + 1 < n);
    if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
  back.hidden = n === 1 || n === 4;
  next.hidden = n === 4;
  next.textContent = n === 3 ? "Confirm booking" : "Continue";
  panels.forEach((p) => { const err = p.querySelector(".error"); if (err) err.textContent = ""; });
}

function validateStep() {
  const panel = panels[step - 1];
  const err = panel.querySelector(".error");
  if (step === 1 && !form.service.value) { err.textContent = "Please choose a service."; return false; }
  if (step === 2 && !form.querySelector('input[name="time"]:checked')) { err.textContent = "Please choose a free time slot."; return false; }
  if (step === 3) {
    let firstBad = null;
    ["fullname", "tel"].forEach((id) => {
      const input = document.getElementById(id);
      const ok = input.checkValidity() && input.value.trim();
      input.setAttribute("aria-invalid", String(!ok));
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) { err.textContent = "Please enter your name and a valid phone number."; firstBad.focus(); return false; }
  }
  return true;
}

next.addEventListener("click", () => {
  if (!validateStep()) return;
  if (step < 3) { show(step + 1); return; }
  const day = days[Number(form.querySelector('input[name="day"]:checked').value)];
  const time = form.querySelector('input[name="time"]:checked').value;
  const name = document.getElementById("fullname").value.trim().split(" ")[0];
  document.getElementById("summary").textContent =
    `Thanks, ${name}! ${form.service.value} on ${fmtLong(day)} at ${time}. We'd text a confirmation in a real clinic. (Demo: nothing was sent.)`;
  show(4);
  panels[3].focus();
});
back.addEventListener("click", () => show(step - 1));
form.addEventListener("submit", (e) => { e.preventDefault(); if (step < 4) next.click(); });
document.getElementById("restart").addEventListener("click", () => {
  form.reset();
  if (days.length) { daysEl.querySelector("input").checked = true; renderSlots(0); }
  show(1);
});

// ---------- Reviews slider ----------
const track = document.getElementById("track");
const slides = track.children.length;
const dots = document.getElementById("dots");
let current = 0;
for (let i = 0; i < slides; i++) {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", `Show review ${i + 1}`);
  b.addEventListener("click", () => go(i, true));
  dots.append(b);
}
function go(i, user) {
  current = (i + slides) % slides;
  track.style.transform = `translateX(-${current * 100}%)`;
  [...dots.children].forEach((d, j) => d.setAttribute("aria-current", String(j === current)));
  if (user) restart();
}
let timer;
function restart() { clearInterval(timer); if (!reduced) timer = setInterval(() => go(current + 1), 6000); }
document.getElementById("prev").addEventListener("click", () => go(current - 1, true));
document.getElementById("nextReview").addEventListener("click", () => go(current + 1, true));
go(0); restart();

document.getElementById("year").textContent = new Date().getFullYear();
