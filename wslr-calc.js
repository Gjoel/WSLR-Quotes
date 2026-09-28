/*!
 * WSLR group estimate calculator 2.1.0 (28 Sept 2026)
 * ---------------------------------------------------------------------------
 * ONE copy for www.wslr.com.au/quote and www.wslr.com.au/functions. Each page
 * only holds a mount point and this script:
 *
 *   <div id="wslr-calc" data-source="estimate-calculator"></div>
 *   <script src="https://gjoel.github.io/WSLR-Quotes/calc/wslr-calc.js" defer></script>
 *
 * (data-source="functions-package-guide" on the /functions page.)
 *
 * Everything else (styles, markup, logic) lives here, inside a shadow root, so
 * the WordPress theme and the calculator can never restyle each other.
 *
 * WHERE THE NUMBERS COME FROM
 *   Cabins      the public rates sheet (tabs RMS_Rates / RMS_Status / Rates),
 *               written from RMS by the rate puller, read through gviz.
 *   Rooms       the WSLR Quote Logger's public read-only action
 *               ?public=calc&from=&to= (Public.gs): venue and meal prices from
 *               the quote maker's own rate card, and free / booked per room per
 *               day from RMS, worked out exactly the way the quote maker does.
 *   Rules       the same as the staff quote maker: marquee free for a group
 *               staying onsite, dining room free while a meal service runs, the
 *               church discount on accommodation AND venues, the 50% tier only
 *               with 3+ catered main meals for everyone, children's meal prices,
 *               the dietary surcharge, deposits and key dates. Plus one
 *               complimentary conference room per 5 cabins from 6 cabins (Joel,
 *               28 Sept 2026), which the quote maker applies too.
 *
 * The estimate is laid out like a row of the Quotes tab on the WSLR Group
 * Confirmations sheet (same bands, headings and colours), with the priced lines
 * underneath.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  var VERSION = '2.1.0';

  /* ======================================================================
     Settings
     ====================================================================== */
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwH01LNaO8ifVNqXUugTT6WcHReneXZvMN4Aro3AIB9hu-sPyN5jvjhEKT4liMXbYhJ/exec';
  /* Its own token, not the staff one: the server lets it append an enquiry and
     nothing else. It is in public source, so it is a speed bump, not a secret. */
  var INTEREST_TOKEN = 'wslr-interest-2026';
  var SHEET_ID = '1ilsRHbyZwF4CGfmlX0AmAF0R50AYVg9HnGzzg9PXLXk';
  function gvizUrl(tab) { return 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(tab); }

  var PHONE = '(02) 4283 6999', TEL = '0242836999', EMAIL = 'functions@wslr.com.au';
  var MENU_URL = 'https://www.wslr.com.au/menu';
  var TOUR = 'https://radian.mintdesign.co.nz/virtual-tour?vt=WpmbkMJezJ&menu=0&scene=';
  /* rates older than this stop being called "live" */
  var STALE_HOURS = 3;

  /* the cabin types, in the order the rates sheet and the Quotes tab use.
     id = the quote maker's rate card item, col = the Quotes tab column. */
  var ROOMS = [
    {name: 'Motel Style Budget Cabin',          id: 'acc_motel_bud', col: 'Motel Budget',      stock: 16, guests: 4,  bedding: '1 King or 2 King Singles + Bunk Bed',          scene: '91K4'},
    {name: 'Motel Style Air-Conditioned Cabin', id: 'acc_motel_std', col: 'Motel Air Con',     stock: 36, guests: 4,  bedding: '1 King or 2 King Singles + Bunk Bed',          scene: '0YxG'},
    {name: '1 Bedroom Air-Conditioned Cabin',   id: 'acc_1br_std',   col: '1 Bed Air Con',     stock: 33, guests: 6,  bedding: '1 King or 2 King Singles + Bunk + Queen Sofa', scene: 'gZ3l'},
    {name: '1 Bedroom Terrace Cabin',           id: 'acc_1br_ter',   col: '1 Bed Terrace',     stock: 6,  guests: 6,  bedding: '1 King or 2 King Singles + Bunk + Queen Sofa', scene: 'jZ3z'},
    {name: '2 Bedroom Air-Conditioned Cabin',   id: 'acc_2br_std',   col: '2 Bed Air Con',     stock: 8,  guests: 7,  bedding: '1 King + 2 Singles + 2 Queen Sofas',            scene: 'k83Y'},
    {name: '2 Bedroom Bungalow',                id: 'acc_2br_bung',  col: '2 Bed Bungalow',    stock: 5,  guests: 6,  bedding: '2 Doubles or 4 Singles + Queen Sofa',           scene: 'lx3J'},
    {name: '2 Bedroom Terrace Apartment',       id: 'acc_2br_ter',   col: '2 Bed Terrace Apt', stock: 3,  guests: 6,  bedding: '2 King Beds or 4 King Singles + Sofa',          scene: 'mO3A'},
    {name: '4 Bedroom Executive Suite',         id: 'acc_4br_house', col: '4 Bed House',       stock: 1,  guests: 10, bedding: '4 King Beds or 8 King Singles + Sofa Bed',      scene: 'r8wk'}
  ];
  /* Quotes tab columns this page never fills (campsites are not sold here) */
  var TRACKER_EXTRA_ACCOM = ['Unpowered Site', 'Waterfront Site', 'Drive Thru Site'];

  /* the conference rooms and venues, keyed like the quote maker (fr13 ...).
     Prices here are the quote maker's defaults; the live rate card replaces them. */
  var VENUES = [
    {key: 'fr13', name: 'Conference Rooms 1, 2 & 3', col: 'Rooms 1-3',   cap: 'Up to 150 people · the three rooms opened into one space', full: 500,  half: 250, members: ['fr1', 'fr2', 'fr3'], conf: true, scene: 'r8wB'},
    {key: 'fr1',  name: 'Conference Room 1',         col: 'Room 1',      cap: 'Up to 50 people · part of the Rooms 1, 2 & 3 space',       full: 500,  half: 250, partOf: 'fr13', conf: true, scene: 'r8wB'},
    {key: 'fr2',  name: 'Conference Room 2',         col: 'Room 2',      cap: 'Up to 50 people · part of the Rooms 1, 2 & 3 space',       full: 500,  half: 250, partOf: 'fr13', conf: true, scene: 'r8wB'},
    {key: 'fr3',  name: 'Conference Room 3',         col: 'Room 3',      cap: 'Up to 50 people · part of the Rooms 1, 2 & 3 space',       full: 500,  half: 250, partOf: 'fr13', conf: true, scene: 'r8wB'},
    {key: 'fr5',  name: 'Conference Room 5',         col: 'Room 5',      cap: 'Up to 45 people · a separate room',                        full: 300,  half: 150, conf: true, scene: 'vlAL'},
    {key: 'aud',  name: 'Auditorium',                col: 'Auditorium',  cap: 'Up to 500 people · 30m × 15m',                              full: 1000, half: 500, conf: true, scene: 'wVBg'},
    {key: 'marq', name: 'Marquee',                   col: 'Marquee',     cap: 'Up to 160 people',                                          full: 150,  half: 75,  scene: 'xnDz'},
    {key: 'din',  name: 'Dining Room',               col: 'Dining Room', cap: 'Up to 120 people · several sittings, shared with other groups', full: 500, half: 250, shared: 3, scene: 'yoEz'}
  ];
  /* one complimentary conference room per 5 cabins from 6 cabins (6-10 = 1, 11-15 = 2 ...),
     given to the rooms in this order, for every day they are booked. The Auditorium only
     counts from 10 cabins (Joel, 28 Sept 2026). The quote maker has the same rule. */
  var FREE_ROOM_FROM = 6, FREE_ROOM_PER = 5, FREE_AUD_FROM = 10;
  var FREE_ORDER = ['fr13', 'fr1', 'fr2', 'fr3', 'fr5', 'aud'];

  var MEALS = [
    {id: 'bf_hot',     slot: 'breakfast', name: 'Breakfast - Hot',         desc: 'Eggs, bacon, sausages + continental',           price: 30},
    {id: 'bf_cont',    slot: 'breakfast', name: 'Breakfast - Continental', desc: 'Cereals, toast, fruit, juice',                  price: 20},
    {id: 'bf_pack',    slot: 'breakfast', name: 'Breakfast - Pack',        desc: 'Cereal, milk, juice, diced fruit, packed for each person', price: 20},
    {id: 'lunch_sit',  slot: 'lunch',     name: 'Lunch - Dine In',         desc: 'Pasta, fish, burger, schnitzel + more',         price: 25},
    {id: 'lunch_pack', slot: 'lunch',     name: 'Lunch - Takeaway',        desc: 'Sandwiches, wraps or rolls + fruit + juice',    price: 20},
    {id: 'din2',       slot: 'dinner',    name: 'Dinner - 2 Course',       desc: 'Main + dessert (roast, stir fry, lasagne + more)', price: 35},
    {id: 'din1',       slot: 'dinner',    name: 'Dinner - 1 Course',       desc: 'Main only',                                     price: 30}
  ];
  var DIET_PRICE = 10;        // per person, per meal
  var KID_413_SHARE = 0.5;    // children 4-12 pay half
  var KID_13_PRICE = 5;       // children over 1 and up to 3: $5 a meal
  var CATER_MIN = 20;
  var GST_PCT = 10;

  var KD = {depositPer: 100, depositSite: 50, depositRoom: 0, depositDays: 7, halfPct: 50, halfDays: 90,
            cateringDays: 10, finalDays: 10, farMonths: 12, farDepositDays: 21};

  /* NSW public school holidays (Eastern division). CHECK ONCE A YEAR and add the next
     year. Each break is widened to the weekend either side, when groups travel. */
  var NSW_HOLIDAYS = [
    {name: 'Summer holidays', from: '2025-12-22', to: '2026-01-26'},
    {name: 'Autumn holidays', from: '2026-04-07', to: '2026-04-17'},
    {name: 'Winter holidays', from: '2026-07-06', to: '2026-07-17'},
    {name: 'Spring holidays', from: '2026-09-28', to: '2026-10-09'},
    {name: 'Summer holidays', from: '2026-12-18', to: '2027-01-27'},
    {name: 'Autumn holidays', from: '2027-04-12', to: '2027-04-23'},
    {name: 'Winter holidays', from: '2027-07-05', to: '2027-07-16'},
    {name: 'Spring holidays', from: '2027-09-27', to: '2027-10-08'},
    {name: 'Summer holidays', from: '2027-12-21', to: '2028-01-28'},
    {name: 'Autumn holidays', from: '2028-04-10', to: '2028-04-21'},
    {name: 'Winter holidays', from: '2028-07-10', to: '2028-07-21'},
    {name: 'Spring holidays', from: '2028-10-03', to: '2028-10-13'},
    {name: 'Summer holidays', from: '2028-12-22', to: '2029-01-25'}
  ];

  /* the Quotes tab look (code.gs formatQuotesSheet_ / STATUS_COLORS) */
  var TK = {
    navy: '#0f2d4a', blue: '#1f5fae', green: '#2e7d32', purple: '#6a4c93', brown: '#b5651d', slate: '#455a64',
    head: '#e8eef5', catered: '#e2f0d9', selfcater: '#fff2cc',
    status: {Draft: ['#eeeeee', '#555555'], Sent: ['#dbe8f8', '#1f5fae']}
  };

  /* ======================================================================
     Small helpers
     ====================================================================== */
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateOf(iso) { var p = String(iso).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function isoAdd(iso, n) { var d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); }
  function todayIso() { return isoOf(new Date()); }
  function isIso(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(dateOf(s)); }
  function daysBetween(a, b) { return Math.round((dateOf(b) - dateOf(a)) / 86400000); }
  function dayLabel(iso) { var d = dateOf(iso); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function longDate(iso) { var d = dateOf(iso); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function shortY(iso) { var d = dateOf(iso); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function nightWord(n) { return n + ' night' + (n === 1 ? '' : 's'); }
  function dayWord(n) { return fmtNum(n) + ' day' + (n === 1 ? '' : 's'); }
  function fmtNum(n) { n = Number(n) || 0; return (Math.round(n * 10) / 10).toString(); }
  function money(n) { n = Math.round(Number(n) || 0); return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-AU'); }
  function money2(n) { n = Number(n) || 0; return '$' + n.toLocaleString('en-AU', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function num(v) { var n = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10); return isNaN(n) ? 0 : n; }
  function truthy(v) { return v === true || /^(true|yes|y|1)$/i.test(String(v == null ? '' : v).trim()); }
  function venueByKey(k) { for (var i = 0; i < VENUES.length; i++) if (VENUES[i].key === k) return VENUES[i]; return null; }
  function mealById(id) { for (var i = 0; i < MEALS.length; i++) if (MEALS[i].id === id) return MEALS[i]; return null; }
  function listWords(arr, joiner) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' ' + (joiner || 'and') + ' ' + arr[arr.length - 1];
  }

  /* ======================================================================
     State
     ====================================================================== */
  var S = {
    arrival: '', departure: '', lastNights: 2,
    guests: 0,
    rooms: {},                     // name -> qty
    venueDays: {},                 // key -> {iso: 'full'|'am'|'pm'}
    who: {adults: null, k412: 0, k13: 0, babies: 0, diet: 0},   // adults null = follow the group size
    meals: {},                     // id -> {on: bool, days: number|null (null = the default)}
    church: 0,                     // 0, 20 or 50
    sent: null                     // {ref, at} once the enquiry is in
  };
  ROOMS.forEach(function (r) { S.rooms[r.name] = 0; });
  MEALS.forEach(function (m) { S.meals[m.id] = {on: false, days: null}; });

  var RATES = {daily: {}, status: {}, range: null, fallback: [], loaded: false, failed: false};
  var PUB = {prices: null, avail: null, availKey: '', availState: 'idle', asAt: '', message: ''};

  /* ======================================================================
     Rates sheet (cabins)
     ====================================================================== */
  function parseGviz(text) {
    var start = text.indexOf('setResponse(');
    if (start < 0) throw new Error('Unexpected sheet response');
    return JSON.parse(text.slice(text.indexOf('(', start) + 1, text.lastIndexOf(')')));
  }
  function cellVal(c) { return (!c || c.v === null || c.v === undefined) ? '' : c.v; }
  function toIso(val) {
    var s = String(val || '').trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/Date\((\d+),(\d+),(\d+)/);
    if (m) return isoOf(new Date(+m[1], +m[2], +m[3]));
    var parts = s.split(' '), mi = MON.indexOf(parts[1]);
    if (parts.length === 3 && mi >= 0) return isoOf(new Date(+parts[2], mi, +parts[0]));
    return null;
  }
  function fetchGviz(tab) {
    return fetch(gvizUrl(tab), {cache: 'no-store'}).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(parseGviz);
  }
  /* RMS_Rates: Date | Day | per cabin type "<Type>", "<Type> | avail", "| min", "| minArr", "| stop", "| coa", "| cod" */
  function parseRmsRates(json) {
    var cols = (json.table.cols || []).map(function (c) { return String(c.label || '').trim(); });
    var dateCol = Math.max(0, cols.indexOf('Date'));
    var daily = {}, from = null, to = null;
    (json.table.rows || []).forEach(function (r) {
      var c = r.c || [], iso = toIso(cellVal(c[dateCol]));
      if (!iso) return;
      var day = {}, any = false;
      ROOMS.forEach(function (rt) {
        var ix = function (suffix) { return cols.indexOf(rt.name + suffix); };
        if (ix('') < 0) return;
        var rateRaw = cellVal(c[ix('')]), rate = rateRaw === '' ? null : Number(rateRaw);
        var availRaw = ix(' | avail') >= 0 ? cellVal(c[ix(' | avail')]) : '', avail = availRaw === '' ? null : Number(availRaw);
        var g = function (suffix) { var i = ix(suffix); return i >= 0 ? cellVal(c[i]) : ''; };
        if ((rate != null && !isNaN(rate) && rate > 0) || (avail != null && !isNaN(avail))) {
          day[rt.name] = {
            rate: (rate != null && !isNaN(rate) && rate > 0) ? rate : null,
            avail: (avail != null && !isNaN(avail)) ? avail : null,
            min: Number(g(' | min')) || 0, minArr: Number(g(' | minArr')) || 0,
            stop: truthy(g(' | stop')), coa: truthy(g(' | coa')), cod: truthy(g(' | cod'))
          };
          any = true;
        }
      });
      if (!any) return;
      daily[iso] = day;
      if (!from || iso < from) from = iso;
      if (!to || iso > to) to = iso;
    });
    RATES.daily = daily;
    RATES.range = from ? {from: from, to: to} : null;
  }
  function parseRmsStatus(json) {
    var out = {};
    (json.table.rows || []).forEach(function (r) {
      var c = r.c || [], k = String(cellVal(c[0])).trim();
      if (k) out[k] = String(cellVal(c[1])).trim();
    });
    RATES.status = out;
  }
  function parseFallback(json) {
    RATES.fallback = (json.table.rows || []).map(function (r) {
      return (r.c || []).map(function (c) {
        if (!c) return '';
        if (typeof c.v === 'number') return c.v;
        return String(c.v || '').trim();
      });
    }).filter(function (r) { return r[0] && r[2]; });
  }
  /* the hand-kept seasonal table: Room Type | Period | From | To | Min Nights | Mon..Sun */
  function seasonal(name, arrIso, nights) {
    var col = {1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 0: 11};
    var total = 0, period = null, minNights = 0;
    for (var i = 0; i < nights; i++) {
      var iso = isoAdd(arrIso, i), dow = dateOf(iso).getDay(), match = null;
      for (var j = 0; j < RATES.fallback.length; j++) {
        var r = RATES.fallback[j];
        if (r[0] !== name) continue;
        var f = toIso(r[2]), t = toIso(r[3]);
        if (f && t && f <= iso && t >= iso) { match = r; break; }
      }
      if (!match) return null;
      if (!period) period = match[1];
      total += parseFloat(match[col[dow]]) || 0;
      minNights = Math.max(minNights, parseInt(match[4], 10) || 0);
    }
    return {total: Math.round(total), period: period, minNights: minNights};
  }
  /* A stay's price and availability for one cabin type. Availability ALWAYS comes from
     the RMS nights we have, even when a night has no rate (a sold-out night often has
     none): before 2.0 a missing rate threw the whole stay onto the seasonal table with
     no stock limit, so sold-out cabins could be picked. */
  function stayPricing(name, arrIso, nights) {
    if (!arrIso || nights <= 0) return null;
    var total = 0, complete = true, minAvail = null, minStay = 0, stop = false, coa = false, cod = false;
    for (var i = 0; i < nights; i++) {
      var iso = isoAdd(arrIso, i), day = RATES.daily[iso] && RATES.daily[iso][name];
      if (day) {
        if (day.avail != null) minAvail = minAvail == null ? day.avail : Math.min(minAvail, day.avail);
        var nightMin = (i === 0 && day.minArr) ? Math.max(day.min || 0, day.minArr) : (day.min || 0);
        if (nightMin > minStay) minStay = nightMin;
        if (day.stop) stop = true;
        if (i === 0 && day.coa) coa = true;
      }
      if (!day || day.rate == null) complete = false; else total += day.rate;
    }
    var dep = RATES.daily[isoAdd(arrIso, nights)];
    if (dep && dep[name] && dep[name].cod) cod = true;
    var out = {total: Math.round(total), source: 'rms', minAvail: minAvail, minStay: minStay, stopSell: stop, closedArr: coa, closedDep: cod};
    if (!complete) {
      var fb = seasonal(name, arrIso, nights);
      if (fb) { out.total = fb.total; out.source = 'sheet'; out.period = fb.period; out.minStay = Math.max(minStay, fb.minNights || 0); }
      else if (minAvail === 0 || stop) { out.total = null; out.source = 'none'; }
      else return null;
    }
    out.soldOut = stop || (minAvail != null && minAvail <= 0);
    return out;
  }
  function roomMax(r, p) {
    if (!p) return r.stock;
    if (p.soldOut) return 0;
    return p.minAvail == null ? r.stock : Math.min(r.stock, p.minAvail);
  }
  function dataRange() {
    var from = RATES.range ? RATES.range.from : null, to = RATES.range ? RATES.range.to : null;
    RATES.fallback.forEach(function (r) {
      var f = toIso(r[2]), t = toIso(r[3]);
      if (f && (!from || f < from)) from = f;
      if (t && (!to || t > to)) to = t;
    });
    return (from && to) ? {from: from, to: to} : null;
  }
  function ratesAge() {
    var m = String(RATES.status['Last successful update'] || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return {date: d, hours: (Date.now() - d.getTime()) / 3600000,
            words: d.getDate() + ' ' + MON[d.getMonth()] + ', ' + d.toLocaleTimeString('en-AU', {hour: 'numeric', minute: '2-digit'}).toLowerCase()};
  }

  /* ======================================================================
     Rooms and prices from the quote server (Public.gs)
     ====================================================================== */
  function applyPrices(p) {
    if (!p || typeof p !== 'object') return;
    PUB.prices = p;
    if (p.venues) VENUES.forEach(function (v) {
      var x = p.venues[v.key];
      if (!x) return;
      if (Number(x.full) >= 0 && x.full !== null && x.full !== '') v.full = Number(x.full);
      if (Number(x.half) >= 0 && x.half !== null && x.half !== '') v.half = Number(x.half);
      v.off = x.off === true;
    });
    if (p.meals) MEALS.forEach(function (m) {
      var x = p.meals[m.id];
      if (!x) return;
      if (Number(x.price) >= 0 && x.price !== null && x.price !== '') m.price = Number(x.price);
      m.off = x.off === true;
    });
    if (p.diet && Number(p.diet.price) >= 0) DIET_PRICE = Number(p.diet.price);
    if (p.keydates) Object.keys(KD).forEach(function (k) {
      var n = Number(p.keydates[k]);
      if (p.keydates[k] !== undefined && p.keydates[k] !== null && p.keydates[k] !== '' && !isNaN(n)) KD[k] = n;
    });
    fillPagePrices();
  }
  /* Prices printed on the page around the calculator (the /functions brochure) follow the
     same rate card: <span data-wslr-price="fr5.full">$300</span>, "meal.bf_pack", "diet". */
  function fillPagePrices() {
    var els = document.querySelectorAll('[data-wslr-price]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-wslr-price').split('.'), val = null, isMeal = false;
      if (k[0] === 'meal') { var m = mealById(k[1]); if (m) { val = m.price; isMeal = true; } }
      else if (k[0] === 'diet') { val = DIET_PRICE; isMeal = true; }
      else { var v = venueByKey(k[0]); if (v) val = k[1] === 'half' ? v.half : v.full; }
      if (val !== null && val !== undefined && !isNaN(val)) els[i].textContent = isMeal ? money2(val) : money(val);
    }
  }
  function serverGet(qs) {
    return fetch(ENDPOINT + '?' + qs, {cache: 'no-store', redirect: 'follow'}).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function loadPrices() {
    return serverGet('public=calc').then(function (j) {
      if (j && j.ok && j.prices) { applyPrices(j.prices); update(); }
    }).catch(function () { /* the defaults stand */ });
  }
  var availTimer = null;
  function scheduleAvail() {
    clearTimeout(availTimer);
    availTimer = setTimeout(loadAvail, 350);
  }
  function loadAvail() {
    var days = eventDays();
    if (!days.length) { PUB.avail = null; PUB.availKey = ''; PUB.availState = 'idle'; update(); return; }
    var key = days[0] + '|' + days[days.length - 1];
    if (key === PUB.availKey && (PUB.availState === 'ok' || PUB.availState === 'loading')) return;
    PUB.availKey = key;
    PUB.availState = 'loading';
    update();
    serverGet('public=calc&from=' + days[0] + '&to=' + days[days.length - 1]).then(function (j) {
      if (PUB.availKey !== key) return;                     // the dates moved on meanwhile
      if (j && j.prices) applyPrices(j.prices);
      if (j && j.ok && j.avail && j.avail.ok && j.avail.venues) {
        PUB.avail = j.avail.venues;
        PUB.asAt = j.avail.asAt || j.asAt || '';
        PUB.availState = 'ok';
      } else {
        PUB.avail = null;
        PUB.availState = 'unknown';
        PUB.message = (j && j.avail && j.avail.message) || '';
      }
      update();
    }).catch(function () {
      if (PUB.availKey !== key) return;
      PUB.avail = null;
      PUB.availState = 'unknown';
      update();
    });
  }
  /* free rooms on a day: 1/0 for a room, 0-3 for the shared dining room, null = not known.
     The combined space is free only when all three of its rooms are. */
  function venueDayAvail(v, iso) {
    var A = PUB.avail;
    if (!A) return null;
    var line = A[v.key];
    if (line && line[iso] !== undefined && line[iso] !== null) return Number(line[iso]);
    if (v.members) {
      var worst = null;
      for (var i = 0; i < v.members.length; i++) {
        var ml = A[v.members[i]];
        if (!ml || ml[iso] === undefined || ml[iso] === null) return null;
        worst = worst === null ? Number(ml[iso]) : Math.min(worst, Number(ml[iso]));
      }
      return worst;
    }
    return null;
  }
  function dayTaken(v, iso) { var a = venueDayAvail(v, iso); return !v.shared && a !== null && a <= 0; }
  function dayTight(v, iso) { var a = venueDayAvail(v, iso); return !!v.shared && a !== null && a < v.shared; }

  /* ======================================================================
     The estimate: one object every screen, the email and the enquiry read from
     ====================================================================== */
  function nightsOf() {
    return (isIso(S.arrival) && isIso(S.departure) && S.departure > S.arrival) ? daysBetween(S.arrival, S.departure) : 0;
  }
  /* every day of the event, arrival to departure inclusive (the quote maker's eventDays) */
  function eventDays() {
    var n = nightsOf();
    if (!n) return [];
    var out = [];
    for (var i = 0; i <= n && i < 62; i++) out.push(isoAdd(S.arrival, i));
    return out;
  }
  function venueDayMap(key) {
    var m = S.venueDays[key] || {}, days = eventDays(), out = {};
    days.forEach(function (iso) { if (m[iso]) out[iso] = m[iso]; });
    return out;
  }
  function venueSplit(key) {
    var m = venueDayMap(key), full = 0, half = 0;
    Object.keys(m).forEach(function (iso) { if (m[iso] === 'full') full++; else half++; });
    return {full: full, half: half, count: full + half / 2, days: m};
  }
  function venueWords(key) {
    var m = venueDayMap(key);
    var w = {full: 'full day', am: 'morning', pm: 'afternoon'};
    return Object.keys(m).sort().map(function (iso) { return dayLabel(iso) + ' ' + w[m[iso]]; }).join(', ');
  }
  function venueBlockedBy(v) {
    if (v.members) {
      for (var i = 0; i < v.members.length; i++) if (venueSplit(v.members[i]).count > 0) return venueByKey(v.members[i]);
      return null;
    }
    if (v.partOf && venueSplit(v.partOf).count > 0) return venueByKey(v.partOf);
    return null;
  }
  /* adults left blank = everyone in the group not counted as a child (the quote maker's whoAdults) */
  function defaultAdults() { return Math.max(0, S.guests - S.who.k412 - S.who.k13 - S.who.babies); }
  function peopleEating() {
    var w = S.who, adults = w.adults == null ? defaultAdults() : w.adults;
    return {adults: adults, k412: w.k412, k13: w.k13, babies: w.babies, diet: w.diet};
  }
  function defaultMealDays(m) {
    var days = eventDays();
    if (!days.length) return 0;
    return m.slot === 'lunch' ? days.length : Math.max(1, days.length - 1);
  }
  function mealDays(m) {
    var st = S.meals[m.id];
    if (!st || !st.on) return 0;
    var max = eventDays().length;
    var d = st.days == null ? defaultMealDays(m) : st.days;
    return Math.max(0, Math.min(max, d));
  }

  function estimate() {
    var E = {};
    E.arrival = S.arrival; E.departure = S.departure;
    E.nights = nightsOf();
    E.days = eventDays();
    E.guests = S.guests;

    /* cabins */
    E.cabins = []; E.accom = 0; E.units = 0; E.beds = 0;
    E.usedFallback = false; E.noRate = false;
    E.minStay = []; E.closedArr = []; E.closedDep = []; E.priced = 0; E.biggestMin = 0;
    ROOMS.forEach(function (r) {
      var p = E.nights ? stayPricing(r.name, S.arrival, E.nights) : null;
      var max = roomMax(r, p);
      if (E.nights && (!p || p.total == null)) max = 0;
      if (S.rooms[r.name] > max) S.rooms[r.name] = max;
      var qty = S.rooms[r.name] || 0;
      var row = {r: r, p: p, qty: qty, max: max, line: (p && p.total != null) ? p.total * qty : 0};
      E.cabins.push(row);
      if (E.nights && !p) E.noRate = true;
      if (p) {
        if (p.total != null) E.priced++;
        if (p.source === 'sheet') E.usedFallback = E.usedFallback || qty > 0;
        if (p.minStay > E.nights) { E.minStay.push({name: r.name, min: p.minStay}); if (p.minStay > E.biggestMin) E.biggestMin = p.minStay; }
        if (p.closedArr) E.closedArr.push(r.name);
        if (p.closedDep) E.closedDep.push(r.name);
      }
      E.accom += row.line;
      E.units += qty;
      E.beds += qty * r.guests;
    });

    /* meals first: the dining room is free while a meal service runs */
    var who = peopleEating();
    E.who = who;
    E.eaters = who.adults + who.k412 + who.k13;
    E.meals = []; E.cater = 0; E.covers = {breakfast: 0, lunch: 0, dinner: 0}; E.services = 0;
    MEALS.forEach(function (m) {
      if (m.off) return;
      var days = mealDays(m);
      var on = !!(S.meals[m.id] && S.meals[m.id].on);
      var perDay = who.adults * m.price + who.k412 * m.price * KID_413_SHARE + who.k13 * KID_13_PRICE + who.diet * DIET_PRICE;
      var cost = days * perDay;
      var covers = days * E.eaters;
      E.meals.push({m: m, on: on, days: days, cost: cost, covers: covers, perDay: perDay});
      if (on && days > 0 && E.eaters > 0) {
        E.cater += cost;
        E.covers[m.slot] += covers;
        E.services += days;
      }
    });
    E.mealServiceOn = E.services > 0;
    E.underCatered = E.mealServiceOn && S.guests > 0 && E.eaters < S.guests;
    E.fifty = {ok: E.services >= 3 && !E.underCatered, services: E.services, under: E.underCatered};
    if (S.church === 50 && !E.fifty.ok) S.church = 0;

    /* venues */
    E.freeRooms = E.units >= FREE_ROOM_FROM ? Math.floor((E.units - 1) / FREE_ROOM_PER) : 0;
    var freeLeft = E.freeRooms;
    var freeByRule = {};
    FREE_ORDER.forEach(function (k) {
      if (k === 'aud' && E.units < FREE_AUD_FROM) return;
      if (freeLeft > 0 && venueSplit(k).count > 0 && !(venueByKey(k) || {}).off) { freeByRule[k] = true; freeLeft--; }
    });
    E.freeUsed = E.freeRooms - freeLeft;
    E.venues = []; E.venue = 0; E.venueFull = 0;
    VENUES.forEach(function (v) {
      if (v.off) return;
      var sp = venueSplit(v.key);
      var price = sp.full * v.full + sp.half * v.half;
      var why = '';
      if (v.key === 'marq' && E.units > 0) why = 'with your stay';
      else if (v.key === 'din' && E.mealServiceOn) why = 'with your meals';
      else if (freeByRule[v.key]) why = 'with ' + E.units + ' cabins';
      var cost = why ? 0 : price;
      var clash = Object.keys(sp.days).filter(function (iso) { return dayTaken(v, iso); });
      E.venues.push({v: v, sp: sp, price: price, cost: cost, freeWhy: why, words: venueWords(v.key), clash: clash});
      E.venue += cost;
      E.venueFull += price;
    });
    E.rooms = E.venues.filter(function (x) { return x.sp.count > 0; }).length;

    /* totals, the quote maker's way */
    E.sub = E.accom + E.venue + E.cater;
    E.churchPct = S.church;
    E.church = (E.accom + E.venue) * E.churchPct / 100;
    E.total = E.sub - E.church;
    E.gst = E.total * GST_PCT / (100 + GST_PCT);
    E.perPerson = S.guests > 0 ? E.total / S.guests : 0;

    /* money and key dates */
    var far = false;
    if (isIso(S.arrival)) {
      var lim = new Date(); lim.setMonth(lim.getMonth() + KD.farMonths);
      far = dateOf(S.arrival) > lim;
    }
    E.kd = {
      deposit: KD.depositPer * E.units + KD.depositRoom * E.rooms,
      depositDays: (far && KD.farDepositDays > 0) ? KD.farDepositDays : KD.depositDays,
      halfPct: KD.halfPct,
      half: E.total * KD.halfPct / 100,
      halfDue: isIso(S.arrival) ? isoAdd(S.arrival, -KD.halfDays) : '',
      finalDue: isIso(S.arrival) ? isoAdd(S.arrival, -KD.finalDays) : '',
      cateringDue: isIso(S.arrival) ? isoAdd(S.arrival, -KD.cateringDays) : ''
    };
    E.catered = E.mealServiceOn;
    E.rowColor = E.catered ? TK.catered : (E.units > 0 ? TK.selfcater : '#ffffff');
    return E;
  }

  /* ======================================================================
     Styles
     ====================================================================== */
  var CSS = [
    ':host{all:initial;display:block;font-family:"Open Sans",Arial,sans-serif;font-size:16px;line-height:1.6;color:#2c2c2c;',
    '--blue:#1E7CB8;--blue-dark:#1B3A6B;--blue-mid:#2A5F9E;--blue-light:#e8f3fb;--blue-pale:#f0f7fc;--teal:#1a8a7a;--teal-dark:#0f5f54;--teal-light:#e8f5f3;',
    '--text:#2c2c2c;--muted:#5a6272;--border:#d0dde8;--bg:#f5f8fb;--ok:#15803d;--warn:#c2410c;--bad:#b91c1c}',
    '*{box-sizing:border-box}',
    'button,input,select,textarea{font:inherit;color:inherit}',
    'a{color:var(--blue)}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.wrap{background:#fff;border:1px solid var(--border);border-top:4px solid var(--blue-dark)}',
    '.intro{background:var(--blue-dark);color:rgba(255,255,255,.8);padding:16px 22px;font-size:14px}',
    '.intro b{color:#fff}',
    '.body{padding:22px}',
    '.grp{margin-bottom:26px}',
    '.gt{font-family:Montserrat,Arial,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--blue-dark);margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px}',
    '.hint{font-size:13px;color:var(--muted);margin:0 0 10px}',
    /* dates and people */
    '.top{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:flex-end;margin-bottom:12px}',
    '.fld{display:flex;flex-direction:column;gap:3px}',
    '.fld label,.lab{font-family:Montserrat,Arial,sans-serif;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}',
    '.fld input,.fld select,.fld textarea{border:1px solid var(--border);border-radius:4px;padding:8px 11px;font-size:14px;background:#fff;min-width:0}',
    '.fld input:focus,.fld select:focus,.fld textarea:focus{outline:2px solid var(--blue-light);border-color:var(--blue)}',
    '.fld input.n{width:96px}',
    '.pill{background:var(--blue-pale);border:1px solid var(--border);border-left:3px solid var(--blue);padding:7px 12px;font-size:13px;color:var(--blue-dark);font-weight:600}',
    '.msg{border-radius:4px;padding:10px 14px;font-size:13.5px;margin:0 0 14px;line-height:1.5}',
    '.msg.err{background:#fff3f3;border:1px solid #fca5a5;border-left:4px solid #dc2626;color:var(--bad);font-weight:600}',
    '.msg.warn{background:#fff7ed;border:1px solid #fdba74;border-left:4px solid #f97316;color:#9a3412;font-weight:600}',
    '.msg.info{background:var(--teal-light);border:1px solid #a7d8d0;border-left:4px solid var(--teal);color:var(--teal-dark)}',
    '.msg.note{background:var(--blue-pale);border:1px solid var(--border);color:var(--muted)}',
    '.msg button{margin-left:6px}',
    '.badge{display:inline-flex;align-items:center;gap:5px;font-family:"Open Sans",Arial,sans-serif;font-size:11.5px;font-weight:600;text-transform:none;letter-spacing:.02em;color:#15803d}',
    '.badge i{width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block}',
    '.badge.old{color:#9a3412}.badge.old i{background:#f97316}',
    '.badge.static{color:var(--muted)}.badge.static i{background:var(--muted)}',
    /* rows */
    '.row{display:grid;grid-template-columns:1fr auto 92px;gap:6px 12px;align-items:center;padding:10px 0;border-bottom:1px solid #eef2f6}',
    '.row:last-child{border-bottom:0}',
    '.row .nm{font-size:15px}',
    '.row .sub{font-size:13px;color:var(--muted)}',
    '.row.out .nm{color:var(--muted)}',
    '.price{font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:15.5px;color:var(--blue);text-align:right}',
    '.price.free{color:var(--ok);font-size:13px}',
    '.ok{color:var(--ok);font-weight:600}.low{color:var(--warn);font-weight:600}.no{color:#dc2626;font-weight:600}',
    '.tour{font-size:12px;margin-left:6px;white-space:nowrap}',
    '.step{display:flex;align-items:center}',
    '.step button{width:32px;height:32px;border:1px solid var(--border);background:var(--bg);color:var(--blue-dark);font-size:18px;font-weight:600;cursor:pointer;line-height:1}',
    '.step button:first-child{border-radius:4px 0 0 4px}.step button:last-child{border-radius:0 4px 4px 0}',
    '.step button:hover:not(:disabled){background:var(--blue-light)}',
    '.step button:disabled{opacity:.35;cursor:not-allowed}',
    '.step output{width:42px;height:32px;border:1px solid var(--border);border-left:0;border-right:0;display:flex;align-items:center;justify-content:center;font-family:Montserrat,Arial,sans-serif;font-weight:600;font-size:14px;color:var(--blue-dark);background:#fff}',
    '.cap{margin-top:6px;font-size:13px;padding:7px 12px;border-radius:4px;background:var(--blue-pale);color:var(--blue-dark)}',
    '.cap.short{background:#fff7ed;color:#9a3412}',
    /* venues */
    '.key{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:12px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:8px 12px;margin-bottom:10px}',
    '.key .vday{min-width:0;padding:2px 8px;cursor:default;pointer-events:none}',
    '.freebox{background:#f0fdf4;border:1px solid #86efac;border-left:3px solid #16a34a;padding:9px 13px;margin-bottom:10px;font-size:13px;color:#15803d;font-weight:600}',
    '.vrow{padding:12px 0;border-bottom:1px solid #eef2f6}',
    '.vrow:last-child{border-bottom:0}',
    '.vtop{display:grid;grid-template-columns:1fr 92px;gap:6px 12px;align-items:start}',
    '.vnote{font-size:12.5px;font-weight:700;margin-top:2px}',
    '.vnote.free{color:var(--ok)}.vnote.taken{color:#b91c1c}',
    '.vnote.shared{color:#a34c14;background:rgba(236,131,90,.13);border-radius:6px;padding:5px 9px;font-weight:600;line-height:1.45}',
    '.vnote.muted{color:var(--muted);font-weight:600}',
    '.strike{text-decoration:line-through;color:var(--muted)}',
    '.freetag{display:inline-block;background:#dcfce7;color:#15803d;border-radius:10px;padding:0 8px;font-size:11.5px;font-weight:700;margin-left:4px}',
    '.vdays{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.vday{appearance:none;border:1.5px solid #cfd6dd;background:#fff;border-radius:9px;padding:5px 9px;min-width:78px;font-size:12px;line-height:1.25;cursor:pointer;text-align:center;color:#0b0b0b}',
    '.vday b{display:block;font-size:12.5px}',
    '.vday span{display:block;font-size:11px;color:#6b6a66}',
    '.vday:hover:not(:disabled){border-color:#2a78d6}',
    '.vday:focus-visible{outline:2px solid #2a78d6;outline-offset:1px}',
    '.vday.full{background:#0b5c8e;border-color:#0b5c8e;color:#fff}.vday.full span{color:#d7e8f5}',
    '.vday.am,.vday.pm{background:#e3f0fa;border-color:#5b9bd0}.vday.am span,.vday.pm span{color:#174a87;font-weight:700}',
    '.vday.taken{background:repeating-linear-gradient(45deg,#f6f1f1,#f6f1f1 5px,#efe6e6 5px,#efe6e6 10px);border-style:dashed;color:#9a6060;cursor:not-allowed}',
    '.vday.taken.full,.vday.taken.am,.vday.taken.pm{background:#c95b5b;border-color:#c95b5b;color:#fff;cursor:pointer}',
    '.vday.tight{border-color:#e0a24a}',
    '.vday:disabled{opacity:.9;cursor:not-allowed}',
    '.vblock{font-size:12.5px;color:var(--muted);margin-top:6px;font-style:italic}',
    /* catering */
    '.who{display:flex;flex-wrap:wrap;gap:10px 16px;background:var(--bg);border:1px solid var(--border);padding:10px 12px;margin-bottom:10px}',
    '.who .fld input{width:84px}',
    '.meal{display:grid;grid-template-columns:auto 1fr auto 92px;gap:6px 12px;align-items:center;padding:9px 0;border-bottom:1px solid #eef2f6}',
    '.meal:last-child{border-bottom:0}',
    '.meal input[type=checkbox]{width:18px;height:18px;accent-color:var(--blue)}',
    '.meal .nm{font-size:14.5px;font-weight:600;color:var(--blue-dark)}',
    '.meal .sub{font-size:12.5px;color:var(--muted)}',
    '.meal.offrow .step{visibility:hidden}',
    /* discount */
    '.disc{border:1px solid var(--border)}',
    '.disc .dh{background:var(--blue-pale);padding:9px 14px;font-family:Montserrat,Arial,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--blue-dark)}',
    '.disc label{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-top:1px solid #eef2f6;cursor:pointer;font-size:14px}',
    '.disc label.locked{opacity:.55;cursor:not-allowed}',
    '.disc input{margin-top:4px;accent-color:var(--blue)}',
    '.disc .sub{display:block;font-size:12px;color:var(--muted)}',
    /* total bar */
    '.tbar{background:var(--blue-dark);color:#fff;padding:18px 22px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}',
    '.tbar .l{font-size:14px;color:rgba(255,255,255,.75)}',
    '.tbar .l b{display:block;color:#fff;font-family:Montserrat,Arial,sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase}',
    '.tbar .amt{font-family:Montserrat,Arial,sans-serif;font-size:34px;font-weight:700;text-align:right;line-height:1.1}',
    '.tbar .amt small{display:block;font-size:13px;font-weight:400;color:rgba(255,255,255,.65);margin-top:4px}',
    /* the Quotes tab look */
    '.est{padding:18px 22px;background:var(--bg);border-top:1px solid var(--border)}',
    '.esthead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
    '.esthead h3{margin:0;font-family:Montserrat,Arial,sans-serif;font-size:14px;color:var(--blue-dark)}',
    '.btn2{background:#fff;border:1px solid var(--blue);color:var(--blue-dark);font-family:Montserrat,Arial,sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:7px 12px;border-radius:3px;cursor:pointer}',
    '.btn2:hover{background:var(--blue-light)}',
    TRACKER_CSS(),
    /* enquiry */
    '.ei{padding:20px 22px;border-top:1px solid var(--border)}',
    '.ei h4{margin:0 0 4px;font-family:Montserrat,Arial,sans-serif;font-size:15px;color:var(--blue-dark)}',
    '.ei p{margin:0 0 12px;font-size:13px;color:var(--muted)}',
    '.eig{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 14px;margin-bottom:12px}',
    '.eig .wide{grid-column:1/-1}',
    '.eig .fld input,.eig .fld select,.eig .fld textarea{width:100%}',
    '.fld.bad input{border-color:#fca5a5;background:#fff8f8}',
    '.fld em{color:#dc2626;font-style:normal}',
    '.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}',
    '.send{width:100%;background:var(--blue);color:#fff;border:0;padding:15px;font-family:Montserrat,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}',
    '.send:hover:not(:disabled){background:var(--blue-mid)}',
    '.send:disabled{opacity:.6;cursor:wait}',
    '.small{font-size:12px;color:var(--muted);text-align:center;margin-top:8px;font-style:italic}',
    '.done{background:#f0fdf4;border:1px solid #86efac;border-left:4px solid #16a34a;padding:15px 18px;border-radius:4px;font-size:13.5px}',
    '.done h4{color:#15803d}',
    /* cheapest dates */
    '.wk{border:1px solid var(--border);border-top:3px solid var(--teal);background:var(--teal-light);margin:4px 0 26px}',
    '.wkh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;flex-wrap:wrap}',
    '.wkh h4{margin:0;font-family:Montserrat,Arial,sans-serif;font-size:12px;font-weight:700;color:var(--teal-dark);text-transform:uppercase;letter-spacing:.07em}',
    '.wkb{padding:0 14px 14px}',
    '.wkc{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px}',
    '.wkc .fld label{color:var(--teal-dark)}',
    '.wkp{background:#fff;border:1px solid var(--border);padding:10px 12px;margin-bottom:10px}',
    '.wkr{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}.wkr:last-child{margin-bottom:0}',
    '.wkr .lab{color:var(--teal-dark);min-width:100px}',
    '.chip{min-width:46px;padding:5px 6px;text-align:center;border:1px solid var(--border);background:var(--bg);border-radius:4px;font-family:Montserrat,Arial,sans-serif;font-size:12px;font-weight:600;color:var(--muted);cursor:pointer}',
    '.chip.must{background:var(--teal);border-color:var(--teal);color:#fff}',
    '.chip.never{background:#fee2e2;border-color:#fca5a5;color:#b91c1c;text-decoration:line-through}',
    '.tbtn{background:#fff;border:1px solid var(--teal);color:var(--teal-dark);font-family:Montserrat,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.04em;padding:6px 11px;border-radius:3px;cursor:pointer}',
    '.tbtn.on{background:var(--teal);color:#fff}',
    '.tgo{background:var(--teal);color:#fff;border:0;padding:10px 20px;font-family:Montserrat,Arial,sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:3px;cursor:pointer}',
    '.tgo:disabled{opacity:.4;cursor:not-allowed}',
    '.wks{border-left:3px solid var(--teal);background:var(--bg);padding:8px 11px;font-size:13px;margin-top:8px}',
    '.wks.bad{border-left-color:#dc2626;background:#fff3f3;color:#b91c1c;font-weight:600}',
    '.wkres{background:#fff;border:1px solid var(--border);margin-top:12px}',
    '.wkrh{background:var(--teal-dark);color:#fff;padding:8px 13px;font-family:Montserrat,Arial,sans-serif;font-size:12px;font-weight:600}',
    '.wkrow{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:10px 13px;border-bottom:1px solid #eef2f6}',
    '.wkrow b{font-family:Montserrat,Arial,sans-serif;color:var(--blue-dark)}',
    '.wkrow .s{display:block;font-size:12px;color:var(--muted)}',
    '.wkcost{text-align:right;font-family:Montserrat,Arial,sans-serif;font-weight:700;color:var(--teal-dark)}',
    '.wp{display:inline-block;background:var(--blue-pale);border:1px solid var(--border);color:var(--blue-dark);font-size:11px;padding:0 7px;border-radius:10px;margin-left:6px}',
    '.wp.best{background:var(--teal);border-color:var(--teal);color:#fff}',
    '.wp.warn{background:#fff7ed;border-color:#fdba74;color:#9a3412}',
    '.wkfoot{padding:9px 13px;font-size:12px;color:var(--muted);background:var(--bg)}',
    '.loading{padding:18px;text-align:center;color:var(--muted);font-size:14px}',
    '@media (max-width:640px){',
    '  .body,.est,.ei{padding:16px}',
    '  .row{grid-template-columns:1fr auto;}',
    '  .row .info{grid-column:1/-1}',
    '  .vtop{grid-template-columns:1fr auto}',
    '  .meal{grid-template-columns:auto 1fr auto}',
    '  .meal .price{grid-column:2/-1}',
    '  .eig{grid-template-columns:1fr}',
    '  .tbar{grid-template-columns:1fr}.tbar .amt{text-align:left}',
    '  .wkrow{grid-template-columns:1fr auto}.wkrow .tgo2{grid-column:1/-1}',
    '  .fld input.n{width:80px}',
    '}'
  ].join('\n');

  function TRACKER_CSS() {
    return [
      '.tk{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#000;background:#fff;border:1px solid #c7c7c7}',
      '.tk-title{background:' + TK.navy + ';color:#fff;font-weight:700;font-size:12px;padding:7px 10px;line-height:1.35}',
      '.tk-band{border-top:3px solid #9aa7b4}',
      '.tk-band:first-of-type{border-top:0}',
      '.tk-bl{color:#fff;font-weight:700;font-size:11.5px;text-align:center;padding:5px 8px;letter-spacing:.02em}',
      '.tk-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr))}',
      '.tk-c{display:flex;flex-direction:column;border-right:1px solid #e2e2e2;border-bottom:1px solid #e2e2e2;min-width:0}',
      '.tk-c.w2{grid-column:span 2}.tk-c.wall{grid-column:1/-1}',
      '.tk-h{background:' + TK.head + ';color:' + TK.navy + ';font-weight:700;font-size:11px;text-align:center;padding:6px 4px;min-height:38px;display:flex;align-items:center;justify-content:center;border-bottom:2px solid ' + TK.navy + ';line-height:1.2}',
      '.tk-c.left .tk-h{justify-content:flex-start;text-align:left;padding-left:7px}',
      '.tk-v{padding:6px;text-align:center;min-height:30px;overflow-wrap:anywhere;flex:1;position:relative}',
      '.tk-c.left .tk-v{text-align:left}',
      '.tk-v.pos{font-weight:700;color:' + TK.navy + '}',
      '.tk-v.first{font-weight:700}',
      '.tk-v.num{text-align:right}',
      '.tk-v .nt{display:block;font-size:10.5px;font-weight:400;color:#444;line-height:1.3;margin-top:2px}',
      '.tk-v.hasnote:after{content:"";position:absolute;top:0;right:0;border-top:6px solid #000;border-left:6px solid transparent}',
      '.tk-st{display:inline-block;padding:1px 9px;font-weight:700}',
      '.tk-t{width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;background:#fff;margin-top:12px;border:1px solid #c7c7c7}',
      '.tk-t th{background:' + TK.head + ';color:' + TK.navy + ';font-weight:700;font-size:11px;padding:6px 7px;border:1px solid #e2e2e2;border-bottom:2px solid ' + TK.navy + ';text-align:left}',
      '.tk-t td{padding:5px 7px;border:1px solid #e2e2e2;vertical-align:top}',
      '.tk-t .r{text-align:right;white-space:nowrap}',
      '.tk-t .free{color:#15803d;font-weight:700}',
      '.tk-t tr.tot td{font-weight:700;background:#fafafa}',
      '.tk-t tr.grand td{font-weight:700;background:' + TK.navy + ';color:#fff;font-size:14px}',
      '.tk-t tr.save td{color:#15803d;font-weight:700}',
      '.tk-t caption{caption-side:top;text-align:left;background:' + TK.slate + ';color:#fff;font-weight:700;font-size:11.5px;padding:5px 8px}',
      '.tk-t td.muted{color:#555;font-size:12px}',
      /* phones: each line stacks, labelled, instead of a table wider than the screen */
      '@media (max-width:640px){',
      '  .tk-g{grid-template-columns:repeat(auto-fill,minmax(98px,1fr))}',
      '  .tk-h{font-size:10.5px;min-height:34px}',
      '  .tk-t thead{display:none}',
      '  .tk-t,.tk-t tbody,.tk-t tr,.tk-t td{display:block;width:100%}',
      '  .tk-t tr{border-bottom:1px solid #d6d6d6;padding:4px 0}',
      '  .tk-t td{border:0;padding:2px 8px}',
      '  .tk-t td.r{text-align:left;white-space:normal}',
      '  .tk-t td[data-h]:before{content:attr(data-h) ": ";font-weight:700;color:' + TK.navy + '}',
      '  .tk-t td:empty{display:none}',
      '}'
    ].join('\n');
  }

  /* ======================================================================
     Markup (built once; the dynamic parts are re-rendered by update())
     ====================================================================== */
  function skeleton() {
    return '' +
    '<div class="wrap">' +
      '<div class="intro">Price your group in a couple of minutes. Cabin rates and availability come from our booking system for your exact dates, ' +
        'and so does whether each conference room is free on each day. <b>All prices are an estimate</b>: we confirm everything with a formal quote.</div>' +
      '<div class="body">' +
        '<div class="grp">' +
          '<div class="gt"><span>Your dates and group</span></div>' +
          '<div class="top">' +
            '<div class="fld"><label for="arr">Check-in</label><input type="date" id="arr"></div>' +
            '<div class="fld"><label for="dep">Check-out</label><input type="date" id="dep"></div>' +
            '<div class="fld"><label for="ppl">People in your group</label><input class="n" type="number" id="ppl" min="1" max="1000" inputmode="numeric" placeholder="e.g. 40"></div>' +
            '<div id="nightsPill" class="pill" hidden></div>' +
          '</div>' +
          '<div id="dateMsg"></div>' +
          '<div id="restrict"></div>' +
        '</div>' +
        '<div class="grp">' +
          '<div class="gt"><span>Accommodation</span><span id="live"></span></div>' +
          '<div id="cabins"><div class="loading">Loading cabin rates…</div></div>' +
          '<div id="capline"></div>' +
        '</div>' +
        wkSkeleton() +
        '<div class="grp">' +
          '<div class="gt"><span>Conference rooms &amp; venues</span><span id="vlive"></span></div>' +
          '<div class="key" aria-hidden="true"><span>Tap a day to cycle it:</span>' +
            '<span class="vday full"><b>Full day</b></span><span class="vday am"><b>Morning</b></span><span class="vday pm"><b>Afternoon</b></span>' +
            '<span class="vday"><b>Not needed</b></span><span class="vday taken"><b>Booked</b></span><span class="vday tight"><b>Shared</b></span>' +
            '<span>Booked = already taken in our booking system. Shared = another group uses the dining room at other sittings.</span></div>' +
          '<div id="freebox"></div>' +
          '<div id="venues"></div>' +
        '</div>' +
        '<div class="grp">' +
          '<div class="gt"><span>Catering</span></div>' +
          '<p class="hint">Tick the meals you would like. Breakfast and dinner are counted for each night and lunch for each day, and you can change the number of days. ' +
            'Want something not listed? Tell us in the message at the bottom. ' +
            'Once booked, <a href="' + MENU_URL + '" target="_blank" rel="noopener">complete the Menu Selection Form</a> for Kate.</p>' +
          '<div class="who">' +
            '<div class="fld"><label for="wA">Adults &amp; 13+</label><input type="number" min="0" id="wA" inputmode="numeric"></div>' +
            '<div class="fld"><label for="wK">Children 4-12</label><input type="number" min="0" id="wK" inputmode="numeric" value="0"></div>' +
            '<div class="fld"><label for="wT">Children 1-3</label><input type="number" min="0" id="wT" inputmode="numeric" value="0"></div>' +
            '<div class="fld"><label for="wB">Under 1</label><input type="number" min="0" id="wB" inputmode="numeric" value="0"></div>' +
            '<div class="fld"><label for="wD">Special diets</label><input type="number" min="0" id="wD" inputmode="numeric" value="0"></div>' +
          '</div>' +
          '<p class="hint" id="whoHint"></p>' +
          '<div id="meals"></div>' +
          '<div id="caterMsg"></div>' +
        '</div>' +
        '<div class="disc" id="disc"></div>' +
      '</div>' +
      '<div class="tbar" aria-live="polite"><div class="l"><b>Estimated total</b>Includes GST. An estimate only: subject to availability and our formal quote.</div><div class="amt" id="total">$0<small>Choose your dates to start</small></div></div>' +
      '<div class="est"><div class="esthead"><h3>Your estimate</h3><span><button class="btn2" type="button" id="print">Print / Save PDF</button></span></div><div id="tracker"></div></div>' +
      '<div class="ei" id="ei">' +
        '<div id="eiDone" hidden></div>' +
        '<div id="eiForm">' +
        '<h4>Send this estimate to our functions team</h4>' +
        '<p>Leave your details and we will come back with a formal quote and confirmed availability. Nothing is held until we confirm it, and we will not add you to any mailing list.</p>' +
        '<div class="eig">' +
          '<div class="fld" id="f-name"><label for="n">Your name <em>*</em></label><input id="n" autocomplete="name" maxlength="80"></div>' +
          '<div class="fld" id="f-email"><label for="e">Email <em>*</em></label><input id="e" type="email" autocomplete="email" maxlength="120"></div>' +
          '<div class="fld"><label for="m">Mobile</label><input id="m" type="tel" autocomplete="tel" maxlength="40"></div>' +
          '<div class="fld"><label for="g">Group or organisation</label><input id="g" maxlength="120" placeholder="Optional"></div>' +
          '<div class="fld"><label for="ev">Type of event</label><select id="ev"><option value="">Not sure yet</option><option>School camp or excursion</option><option>Church or community group</option><option>Conference or corporate</option><option>Sports group or team</option><option>Family or social gathering</option><option>Other</option></select></div>' +
          '<div class="fld"><label for="fm">How firm are your dates?</label><select id="fm"><option value="">Not sure yet</option><option>Dates are locked in</option><option>Fairly firm, some flexibility</option><option>Completely flexible, best price wins</option></select></div>' +
          '<div class="fld wide"><label for="msgt">Anything else we should know</label><textarea id="msgt" rows="2" maxlength="1200" placeholder="Optional. Numbers still to confirm, meal times, accessibility needs, arrival time, anything at all."></textarea></div>' +
        '</div>' +
        '<div class="hp" aria-hidden="true"><label>Leave empty<input id="hpx" tabindex="-1" autocomplete="off"></label></div>' +
        '<button class="send" type="button" id="send">Send my estimate to the functions team</button>' +
        '<div id="sendMsg" role="status"></div>' +
        '<p class="small">Prefer to email us yourself? <a href="#" id="mailto">Open this estimate in your own email app</a>, or call ' + PHONE + '.</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ======================================================================
     Rendering
     ====================================================================== */
  var root = null;
  function $(id) { return root.getElementById(id); }

  function renderDates(E) {
    var pill = $('nightsPill');
    if (E.nights) { pill.hidden = false; pill.textContent = nightWord(E.nights); } else pill.hidden = true;
    var parts = [], all = function (n) { return E.priced > 0 && n >= E.priced; };
    if (E.nights && E.minStay.length) {
      var same = E.minStay.every(function (i) { return i.min === E.minStay[0].min; });
      var names = E.minStay.map(function (i) { return i.name; }).join(', ');
      if (same && all(E.minStay.length)) parts.push('These dates have a minimum stay of ' + nightWord(E.minStay[0].min) + '.');
      else if (same) parts.push('These dates have a minimum stay of ' + nightWord(E.minStay[0].min) + ' on ' + names + '.');
      else parts.push('Some cabin types have a minimum stay over these dates (' + E.minStay.map(function (i) { return i.name + ': ' + nightWord(i.min); }).join('; ') + ').');
      parts.push('Shorter stays may still be possible for groups, so please ask us.');
    }
    if (E.nights && E.closedArr.length) parts.push(all(E.closedArr.length) ? 'Our booking system is not taking arrivals on this date.' : 'Some cabin types cannot be arrived into on this date (' + E.closedArr.join(', ') + ').');
    if (E.nights && E.closedDep.length) parts.push(all(E.closedDep.length) ? 'Our booking system is not taking departures on your check-out date.' : 'Some cabin types cannot be departed on your check-out date (' + E.closedDep.join(', ') + ').');
    E.restrictions = parts.join(' ');
    $('restrict').innerHTML = parts.length
      ? '<div class="msg warn">&#9888; ' + esc(parts.join(' ')) +
        (E.biggestMin > E.nights ? ' <button class="tgo" type="button" data-act="extend" data-n="' + E.biggestMin + '">Make it ' + E.biggestMin + ' nights</button>' : '') +
        ' <a href="tel:' + TEL + '">' + PHONE + '</a></div>'
      : '';
  }

  function renderLive() {
    var el = $('live');
    if (!RATES.loaded) { el.innerHTML = ''; return; }
    if (RATES.range) {
      var age = ratesAge();
      if (age && age.hours > STALE_HOURS) el.innerHTML = '<span class="badge old" title="Our rate feed has not refreshed recently"><i></i>Rates last checked ' + esc(age.words) + '</span>';
      else el.innerHTML = '<span class="badge" title="Rates, availability and minimum stays come from our booking system, refreshed every hour"><i></i>Live rates &amp; availability' + (age ? ' · checked ' + esc(age.words) : '') + '</span>';
    } else {
      el.innerHTML = '<span class="badge static"><i></i>Seasonal rate schedule</span>';
    }
  }

  function renderCabins(E) {
    if (!RATES.loaded) return;
    if (RATES.failed) {
      $('cabins').innerHTML = '<div class="msg err">We could not load cabin rates just now. Please call us on ' + PHONE + ' for current rates, or send your details below and we will price it for you.</div>';
      return;
    }
    $('cabins').innerHTML = E.cabins.map(function (c) {
      var r = c.r, p = c.p, info;
      if (!E.nights) info = 'Choose your dates for prices';
      else if (!p) info = '<span class="no">No rates loaded for these dates, please call us</span>';
      else {
        var avail = '';
        if (p.stopSell) avail = ' · <span class="no">Not available for these dates, call us to check</span>';
        else if (p.minAvail != null) {
          if (p.minAvail <= 0) avail = ' · <span class="no">Sold out for these dates, call us to check</span>';
          else if (p.minAvail <= 3 && p.minAvail < r.stock) avail = ' · <span class="low">Only ' + p.minAvail + ' of ' + r.stock + ' left</span>';
          else avail = ' · <span class="ok">' + p.minAvail + ' of ' + r.stock + ' available</span>';
        }
        var extra = '';
        if (p.minStay > E.nights) extra += ' · <span class="low">Minimum ' + nightWord(p.minStay) + '</span>';
        if (p.closedArr) extra += ' · <span class="low">No arrivals on this date</span>';
        if (p.closedDep) extra += ' · <span class="low">No departures on your check-out date</span>';
        info = nightWord(E.nights) + (p.total != null ? ' · <b style="color:var(--blue-dark)">' + money(p.total) + ' per cabin</b>' : '') + avail + extra;
      }
      var out = c.max <= 0 && E.nights;
      return '<div class="row' + (out ? ' out' : '') + '">' +
        '<div class="info"><div class="nm">' + esc(r.name) + '<a class="tour" href="' + TOUR + r.scene + '" target="_blank" rel="noopener">Virtual tour &#8599;</a></div>' +
          '<div class="sub">Sleeps ' + r.guests + ' · ' + esc(r.bedding) + ' · ' + r.stock + ' in total</div>' +
          '<div class="sub">' + info + '</div></div>' +
        '<div class="step"><button type="button" data-act="cab" data-k="' + esc(r.name) + '" data-d="-1" aria-label="One fewer ' + esc(r.name) + '"' + (c.qty <= 0 ? ' disabled' : '') + '>&minus;</button>' +
          '<output aria-label="' + esc(r.name) + ' wanted">' + c.qty + '</output>' +
          '<button type="button" data-act="cab" data-k="' + esc(r.name) + '" data-d="1" aria-label="One more ' + esc(r.name) + '"' + (c.qty >= c.max ? ' disabled' : '') + '>+</button></div>' +
        '<div class="price">' + (c.qty > 0 && c.p && c.p.total != null ? money(c.line) : '–') + '</div>' +
      '</div>';
    }).join('');
    var cap = '';
    if (E.units > 0) {
      var short = S.guests > 0 && E.beds < S.guests;
      cap = '<div class="cap' + (short ? ' short' : '') + '">' + E.units + ' cabin' + (E.units === 1 ? '' : 's') + ' sleeping up to ' + E.beds +
        (S.guests > 0 ? (short ? ' · your group is ' + S.guests + ', so you may need ' + (S.guests - E.beds) + ' more bed' + (S.guests - E.beds === 1 ? '' : 's') : ' · your group of ' + S.guests + ' fits') : '') + '</div>';
    }
    $('capline').innerHTML = cap;
  }

  function renderVenues(E) {
    var days = E.days;
    var vlive = $('vlive');
    if (!days.length) vlive.innerHTML = '';
    else if (PUB.availState === 'loading') vlive.innerHTML = '<span class="badge static"><i></i>Checking which rooms are free…</span>';
    else if (PUB.availState === 'ok') vlive.innerHTML = '<span class="badge"><i></i>Room availability from our booking system' + (PUB.asAt ? ' · ' + esc(asAtWords(PUB.asAt)) : '') + '</span>';
    else vlive.innerHTML = '<span class="badge old"><i></i>We will confirm room availability for you</span>';

    $('freebox').innerHTML = E.freeRooms > 0
      ? '<div class="freebox">With ' + E.units + ' cabins your group gets ' + E.freeRooms + ' complimentary conference room' + (E.freeRooms === 1 ? '' : 's') +
        ' (one for every 5 cabins, from 6 cabins; the Auditorium from ' + FREE_AUD_FROM + ' cabins).' +
        (E.freeUsed < E.freeRooms ? ' Pick the room' + (E.freeRooms === 1 ? '' : 's') + ' below.' : '') + '</div>'
      : (E.units > 0 && E.units < FREE_ROOM_FROM ? '<p class="hint">Book ' + FREE_ROOM_FROM + ' or more cabins and a conference room is complimentary (one for every 5 cabins; the Auditorium from ' + FREE_AUD_FROM + ' cabins).</p>' : '');

    if (!days.length) {
      $('venues').innerHTML = '<p class="hint">Choose your check-in and check-out dates above, then pick the days you need each room.</p>';
      return;
    }
    $('venues').innerHTML = E.venues.map(function (x) {
      var v = x.v, blk = venueBlockedBy(v);
      var priceWords = money(v.full) + ' full day · ' + money(v.half) + ' half day';
      var note = '';
      if (blk) note = '<div class="vblock">(' + (v.members ? 'the single rooms are picked below: take those off to book the whole space' : 'included in ' + esc(blk.name) + ' above') + ')</div>';
      else if (PUB.availState === 'ok') {
        var taken = [], tight = [], known = 0;
        days.forEach(function (iso) {
          var a = venueDayAvail(v, iso);
          if (a === null) return;
          known++;
          if (v.shared) { if (a <= 0) taken.push(iso); else if (a < v.shared) tight.push(iso); }
          else if (a <= 0) taken.push(iso);
        });
        if (!known) note = '<div class="vnote muted">We will check this room for you</div>';
        else if (v.shared && (taken.length || tight.length)) {
          note = '<div class="vnote shared">Another group is booked in on ' + esc(dayList(taken.concat(tight))) + '. The dining room runs several sittings, so tell us your meal times and we will work them in.</div>';
        } else if (taken.length) {
          note = '<div class="vnote taken">Already booked ' + esc(dayList(taken)) + (taken.length < days.length ? ' · free on the other days' : '') + '</div>';
        } else note = '<div class="vnote free">Free for ' + (days.length === 1 ? 'your day' : 'all ' + days.length + ' days') + '</div>';
      } else if (PUB.availState === 'loading') note = '<div class="vnote muted">Checking…</div>';
      var chips = days.map(function (iso) {
        var st = x.sp.days[iso] || '';
        var tk = dayTaken(v, iso), tg = dayTight(v, iso);
        var lock = !!blk || (tk && !st);
        var word = tk && !st ? 'Booked' : (tg && !st ? 'Shared' : {'': 'Not needed', full: 'Full day', am: 'Morning', pm: 'Afternoon'}[st]);
        var title = dayLabel(iso) + ': ' + (tk ? 'already booked in our booking system' : (tg ? 'another group is in at other sittings' : word));
        return '<button type="button" class="vday' + (st ? ' ' + st : '') + (tk ? ' taken' : '') + (tg ? ' tight' : '') + '" data-act="vday" data-k="' + v.key + '" data-iso="' + iso + '"' +
          (lock ? ' disabled' : '') + ' aria-label="' + esc(v.name + ', ' + title) + '" title="' + esc(title) + '"><b>' + esc(dayLabel(iso)) + '</b><span>' + esc(word) + '</span></button>';
      }).join('');
      var costTxt = x.sp.count > 0 ? (x.freeWhy ? '<div class="price free">Included</div>' : '<div class="price">' + money(x.cost) + '</div>') : '<div class="price">–</div>';
      return '<div class="vrow">' +
        '<div class="vtop"><div>' +
          '<div class="nm" style="font-size:15px">' + esc(v.name) + '<a class="tour" href="' + TOUR + v.scene + '" target="_blank" rel="noopener">Virtual tour &#8599;</a></div>' +
          '<div class="sub" style="font-size:13px;color:var(--muted)">' + esc(v.cap) + ' · ' +
            (x.freeWhy && x.sp.count > 0 ? '<span class="strike">' + priceWords + '</span><span class="freetag">Included ' + esc(x.freeWhy) + '</span>' : priceWords) + '</div>' +
          note +
        '</div>' + costTxt + '</div>' +
        '<div class="vdays" role="group" aria-label="' + esc(v.name) + ' days">' + chips + '</div>' +
      '</div>';
    }).join('');
  }
  function dayList(isos) {
    var arr = isos.slice().sort();
    if (arr.length <= 3) return arr.map(dayLabel).join(', ');
    return arr.slice(0, 2).map(dayLabel).join(', ') + ' and ' + (arr.length - 2) + ' more days';
  }
  function asAtWords(s) {
    var d = new Date(s);
    if (isNaN(d)) return '';
    return 'checked ' + d.toLocaleTimeString('en-AU', {hour: 'numeric', minute: '2-digit'}).toLowerCase();
  }

  function renderMeals(E) {
    var w = S.who;
    var a = $('wA');
    if (root.activeElement !== a) a.value = w.adults == null ? '' : w.adults;
    a.placeholder = S.guests ? String(defaultAdults()) : '';
    $('whoHint').textContent = 'Children 4-12 are half price, children 1-3 are $' + KID_13_PRICE + ' a meal and under 1 eat free. Special diets are $' + DIET_PRICE + ' a meal each, and are counted within the numbers above.';
    if (!E.nights) {
      $('meals').innerHTML = '<p class="hint">Choose your dates above to price catering.</p>';
      $('caterMsg').innerHTML = '';
      return;
    }
    var maxDays = E.days.length;
    $('meals').innerHTML = E.meals.map(function (x) {
      var m = x.m;
      return '<div class="meal' + (x.on ? '' : ' offrow') + '">' +
        '<input type="checkbox" id="ml-' + m.id + '" data-act="meal" data-k="' + m.id + '"' + (x.on ? ' checked' : '') + '>' +
        '<label for="ml-' + m.id + '"><span class="nm">' + esc(m.name) + ' · ' + money2(m.price) + ' pp</span><span class="sub" style="display:block">' + esc(m.desc) +
          (x.on && E.eaters > 0 ? ' · ' + x.covers + ' serves (' + E.eaters + ' people × ' + dayWord(x.days) + ')' : '') + '</span></label>' +
        '<div class="step"><button type="button" data-act="mdays" data-k="' + m.id + '" data-d="-1" aria-label="One day fewer of ' + esc(m.name) + '"' + (x.days <= 1 ? ' disabled' : '') + '>&minus;</button>' +
          '<output aria-label="' + esc(m.name) + ' days">' + x.days + '</output>' +
          '<button type="button" data-act="mdays" data-k="' + m.id + '" data-d="1" aria-label="One more day of ' + esc(m.name) + '"' + (x.days >= maxDays ? ' disabled' : '') + '>+</button></div>' +
        '<div class="price">' + (x.on && x.cost > 0 ? money(x.cost) : '–') + '</div>' +
      '</div>';
    }).join('');
    var msgs = [];
    if (E.mealServiceOn && E.eaters > 0 && E.eaters < CATER_MIN) msgs.push('<div class="msg warn">Catering is for groups of ' + CATER_MIN + ' or more. Tell us about your group and we will see what we can do.</div>');
    if (E.mealServiceOn && E.eaters === 0) msgs.push('<div class="msg warn">Add the people eating above to price the meals.</div>');
    if (E.underCatered) msgs.push('<div class="msg note">' + E.eaters + ' of your ' + S.guests + ' people are down for meals.</div>');
    $('caterMsg').innerHTML = msgs.join('');
  }

  function renderDisc(E) {
    var f = E.fifty;
    var fiftyHint = f.ok ? 'Needs ACNC registration or a religious affiliation. Subject to management approval.'
      : 'Unlocks with at least 3 catered main meals for everyone in the group (you have ' + f.services + (f.under ? ', and not everyone is catered for' : '') + ').';
    $('disc').innerHTML = '<div class="dh">Church &amp; charitable group discounts</div>' +
      '<label><input type="radio" name="church" data-act="church" value="0"' + (S.church === 0 ? ' checked' : '') + '><span>No discount</span></label>' +
      '<label><input type="radio" name="church" data-act="church" value="20"' + (S.church === 20 ? ' checked' : '') + '><span>20% off accommodation and venue hire<span class="sub">For registered charities (ACNC) and church groups. Subject to management approval.</span></span></label>' +
      '<label class="' + (f.ok ? '' : 'locked') + '"><input type="radio" name="church" data-act="church" value="50"' + (S.church === 50 ? ' checked' : '') + (f.ok ? '' : ' disabled') + '><span>50% off accommodation and venue hire<span class="sub">' + esc(fiftyHint) + '</span></span></label>';
  }

  function renderTotal(E) {
    var sub = E.nights ? nightWord(E.nights) + ' · ' + shortY(S.arrival) + ' to ' + shortY(S.departure) + (S.guests ? ' · ' + S.guests + ' people' : '') : 'Choose your dates to start';
    $('total').innerHTML = money(E.total) + '<small>' + esc(sub) + (E.perPerson > 0 ? ' · about ' + money(E.perPerson) + ' per person' : '') + '</small>';
  }

  /* ---------- the Quotes tab row, as the guest sees it ---------- */
  function trackerHTML(E, forPrint) {
    var sent = S.sent;
    var contact = val('n'), group = val('g') || contact || '';
    var st = sent ? 'Sent' : 'Draft';
    var stc = TK.status[st];
    var bg = E.rowColor;
    function cell(h, v, cls, note) {
      var pos = typeof v === 'number' && v > 0;
      var shown = typeof v === 'number' ? (v > 0 ? fmtNum(v) : '') : v;
      return '<div class="tk-c' + (cls ? ' ' + cls : '') + '"><div class="tk-h">' + esc(h) + '</div>' +
        '<div class="tk-v' + (pos ? ' pos' : '') + (note ? ' hasnote' : '') + (cls && cls.indexOf('first') >= 0 ? ' first' : '') + '" style="background:' + bg + '">' +
        (typeof shown === 'string' && shown.indexOf('<') === 0 ? shown : esc(shown)) + (note ? '<span class="nt">' + esc(note) + '</span>' : '') + '</div></div>';
    }
    function band(label, color, cells) {
      return '<div class="tk-band"><div class="tk-bl" style="background:' + color + '">' + label + '</div><div class="tk-g">' + cells.join('') + '</div></div>';
    }
    var accomCells = ROOMS.map(function (r) { return cell(r.col, S.rooms[r.name] || 0); })
      .concat(TRACKER_EXTRA_ACCOM.map(function (c) { return cell(c, 0); }));
    var venueCells = VENUES.map(function (v) {
      var x = E.venues.filter(function (y) { return y.v === v; })[0];
      var n = x ? x.sp.count : 0;
      var note = x && n > 0 ? x.words + (x.freeWhy ? ' (included ' + x.freeWhy + ')' : '') : '';
      return cell(v.col, n, '', note);
    });
    var html = '<div class="tk">' +
      '<div class="tk-title">WSLR GROUP ESTIMATE &nbsp;·&nbsp; green row = catered · amber row = staying, self-catering</div>' +
      band('QUOTE &amp; CONTACT', TK.navy, [
        cell('Quote #', sent && sent.ref ? sent.ref : 'Estimate', 'first'),
        cell('Contact', contact), cell('Mobile', val('m')), cell('Email', val('e'), 'w2'),
        cell('Group Name', group), cell('Event', val('ev')), cell('Guests', S.guests || 0)
      ]) +
      band('DATES, STATUS &amp; VALUE', TK.blue, [
        cell('Arrival', isIso(S.arrival) ? longDate(S.arrival) : ''), cell('Departure', isIso(S.departure) ? longDate(S.departure) : ''),
        cell('Date Sent', sent ? sent.at : ''), cell('Due Back', ''),
        cell('Status', '<span class="tk-st" style="background:' + stc[0] + ';color:' + stc[1] + '">' + st + '</span>'),
        cell('RMS Res', ''),
        cell('Total (inc GST)', E.total > 0 ? money(E.total) : '', 'num')
      ]) +
      band('CATERING (covers)', TK.green, [cell('Breakfast', E.covers.breakfast), cell('Lunch', E.covers.lunch), cell('Dinner', E.covers.dinner)]) +
      band('ACCOMMODATION (units wanted)', TK.purple, accomCells) +
      band('CONFERENCE ROOMS (days wanted)', TK.brown, venueCells) +
      band('NOTES', TK.slate, [cell('Additional information', val('msgt'), 'wall left')]) +
      '</div>';
    html += pricedTableHTML(E);
    html += keyDatesHTML(E);
    return html;
  }
  function val(id) { var el = root && $(id); return el ? String(el.value || '').trim() : ''; }

  function pricedTableHTML(E) {
    var rows = [];
    E.cabins.forEach(function (c) {
      if (c.qty > 0 && c.p && c.p.total != null) rows.push([esc(c.r.name) + (c.p.source === 'sheet' ? ' <span class="muted">(seasonal rate)</span>' : ''), c.qty, nightWord(E.nights), money(c.p.total) + ' per cabin', money(c.line)]);
    });
    E.venues.forEach(function (x) {
      if (x.sp.count <= 0) return;
      var unit = [];
      if (x.sp.full) unit.push(x.sp.full + ' × full day ' + money(x.v.full));
      if (x.sp.half) unit.push(x.sp.half + ' × half day ' + money(x.v.half));
      rows.push([esc(x.v.name) + '<br><span class="muted">' + esc(x.words) + '</span>', fmtNum(x.sp.count), dayWord(x.sp.count), esc(unit.join(' + ')),
                 x.freeWhy ? '<span class="free">Included ' + esc(x.freeWhy) + '</span>' : money(x.cost)]);
    });
    E.meals.forEach(function (x) {
      if (!x.on || x.days <= 0 || E.eaters <= 0) return;
      var who = [];
      if (E.who.adults) who.push(E.who.adults + ' adults');
      if (E.who.k412) who.push(E.who.k412 + ' aged 4-12');
      if (E.who.k13) who.push(E.who.k13 + ' aged 1-3');
      if (E.who.diet) who.push(E.who.diet + ' special diets');
      rows.push([esc(x.m.name) + '<br><span class="muted">' + esc(who.join(', ')) + '</span>', x.covers + ' serves', dayWord(x.days), money2(x.m.price) + ' pp', money(x.cost)]);
    });
    if (!rows.length) return '<table class="tk-t"><caption>PRICE BREAKDOWN</caption><tr><td class="muted">Add cabins, rooms or meals above and the prices show here.</td></tr></table>';
    var h = '<table class="tk-t"><caption>PRICE BREAKDOWN</caption><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">For</th><th class="r">Rate</th><th class="r">Total</th></tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr><td>' + r[0] + '</td><td class="r" data-h="Qty">' + r[1] + '</td><td class="r" data-h="For">' + r[2] + '</td><td class="r" data-h="Rate">' + r[3] + '</td><td class="r" data-h="Total">' + r[4] + '</td></tr>'; });
    h += '<tr class="tot"><td colspan="4">Subtotal</td><td class="r">' + money(E.sub) + '</td></tr>';
    if (E.church > 0) h += '<tr class="save"><td colspan="4">' + E.churchPct + '% church / charitable discount on accommodation and venue hire (subject to approval)</td><td class="r">−' + money(E.church) + '</td></tr>';
    h += '<tr class="grand"><td colspan="4">Estimated total (inc GST)</td><td class="r">' + money(E.total) + '</td></tr>';
    h += '<tr><td colspan="4" class="muted">Includes GST of ' + money2(E.gst) + (E.perPerson > 0 ? ' · about ' + money(E.perPerson) + ' per person' : '') + '</td><td></td></tr>';
    if (E.usedFallback) h += '<tr><td colspan="5" class="muted">Some cabin rates are from our seasonal rate schedule, not live from the booking system. We confirm exact prices in your quote.</td></tr>';
    h += '</tbody></table>';
    return h;
  }
  function keyDatesHTML(E) {
    if (!E.nights || E.total <= 0) return '';
    var k = E.kd, rows = [];
    if (k.deposit > 0) rows.push(['Deposit to hold your cabins', money(k.deposit) + ' (' + money(KD.depositPer) + ' a cabin)', 'Within ' + k.depositDays + ' days of the deposit invoice (sent when you accept your quote)']);
    var partDue = k.halfDue && k.halfDue > todayIso() ? longDate(k.halfDue) : 'With your deposit (your stay is less than ' + KD.halfDays + ' days away)';
    rows.push([k.halfPct + '% of the total', money(k.half) + (k.deposit > 0 ? ' (less your deposit: ' + money(Math.max(0, k.half - k.deposit)) + ')' : ''), partDue]);
    if (E.mealServiceOn) rows.push(['Final catering numbers', '', k.cateringDue ? longDate(k.cateringDue) : '']);
    rows.push(['Final numbers and the balance', money(Math.max(0, E.total - Math.max(k.half, k.deposit))), 'Before arrival' + (k.finalDue ? ' (numbers by ' + longDate(k.finalDue) + ')' : '')]);
    var h = '<table class="tk-t"><caption>MONEY &amp; KEY DATES (as your quote would set them)</caption><thead><tr><th>What</th><th class="r">Amount</th><th>When</th></tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr><td>' + esc(r[0]) + '</td><td class="r"' + (r[1] ? ' data-h="Amount"' : '') + '>' + esc(r[1]) + '</td><td data-h="When">' + esc(r[2]) + '</td></tr>'; });
    return h + '</tbody></table>';
  }

  /* ======================================================================
     Update loop
     ====================================================================== */
  var LAST = null;
  function update() {
    if (!root) return;
    var E = estimate();
    LAST = E;
    renderDates(E);
    renderLive();
    renderCabins(E);
    renderVenues(E);
    renderMeals(E);
    renderDisc(E);
    renderTotal(E);
    $('tracker').innerHTML = trackerHTML(E);
    wkSync();
  }

  /* ---------- dates: never let the pair invert ---------- */
  function datesChanged(source) {
    var a = $('arr'), d = $('dep');
    var msg = '';
    var t = todayIso();
    S.arrival = isIso(a.value) ? a.value : '';
    S.departure = isIso(d.value) ? d.value : '';
    if (S.arrival && S.arrival < t) { msg = '<div class="msg err">Check-in cannot be in the past.</div>'; S.arrival = ''; }
    if (S.arrival && S.departure && S.departure <= S.arrival) {
      var keep = Math.max(1, S.lastNights || 2);
      if (source === 'dep') {
        var na = isoAdd(S.departure, -keep);
        if (na < t) { S.departure = isoAdd(S.arrival, keep); d.value = S.departure; msg = '<div class="msg info">Check-out moved to ' + longDate(S.departure) + ' to keep ' + nightWord(keep) + '.</div>'; }
        else { S.arrival = na; a.value = na; msg = '<div class="msg info">Check-in moved to ' + longDate(na) + ' to keep ' + nightWord(keep) + '.</div>'; }
      } else {
        S.departure = isoAdd(S.arrival, keep); d.value = S.departure;
        msg = '<div class="msg info">Check-out moved to ' + longDate(S.departure) + ' to keep ' + nightWord(keep) + '.</div>';
      }
    }
    if (S.arrival && !S.departure && source === 'arr') { S.departure = isoAdd(S.arrival, Math.max(1, S.lastNights || 2)); d.value = S.departure; }
    if (S.arrival) d.min = isoAdd(S.arrival, 1);
    var n = nightsOf();
    if (n > 60) { msg = '<div class="msg err">For stays over 60 nights please call us on ' + PHONE + '.</div>'; S.departure = ''; }
    if (n) S.lastNights = n;
    $('dateMsg').innerHTML = msg;
    if (!WK.nightsTouched && n) { WK.nights = n; var wn = $('wkn'); if (wn) wn.value = n; }
    scheduleAvail();
    update();
  }

  function stepCabin(name, d) {
    var r = null;
    ROOMS.forEach(function (x) { if (x.name === name) r = x; });
    if (!r) return;
    var p = nightsOf() ? stayPricing(name, S.arrival, nightsOf()) : null;
    S.rooms[name] = Math.max(0, Math.min(roomMax(r, p), (S.rooms[name] || 0) + d));
    update();
  }
  function cycleVenueDay(key, iso) {
    var v = venueByKey(key);
    if (!v || venueBlockedBy(v)) return;
    var cur = (S.venueDays[key] || {})[iso] || '';
    var next = {'': 'full', full: 'am', am: 'pm', pm: ''}[cur];
    if (next && !cur && dayTaken(v, iso)) return;     // booked: only an existing pick can be cycled off
    if (!S.venueDays[key]) S.venueDays[key] = {};
    if (next) S.venueDays[key][iso] = next; else delete S.venueDays[key][iso];
    update();
    var b = root.querySelector('.vday[data-k="' + key + '"][data-iso="' + iso + '"]');
    if (b) b.focus();
  }
  function toggleMeal(id, on) {
    S.meals[id].on = on;
    if (on && S.meals[id].days == null) S.meals[id].days = null;
    update();
  }
  function stepMealDays(id, d) {
    var m = mealById(id);
    if (!m) return;
    var cur = mealDays(m) || defaultMealDays(m);
    S.meals[id].days = Math.max(1, Math.min(eventDays().length, cur + d));
    update();
    var b = root.querySelector('[data-act="mdays"][data-k="' + id + '"][data-d="' + d + '"]');
    if (b && !b.disabled) b.focus();
  }

  /* ======================================================================
     Cheapest dates (cabins only)
     ====================================================================== */
  var WK = {nights: 2, nightsTouched: false, must: [], never: [], hols: 'any', results: null, skipped: 0, fallback: false, ran: false, open: true};
  var DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
  var PRESETS = {any: {must: [], never: [], min: 1}, weekend: {must: [5, 6], never: [], min: 2}, weeknights: {must: [], never: [5, 6, 0], min: 1}};
  var HOLS = null;
  function holidayWindows() {
    if (HOLS) return HOLS;
    HOLS = NSW_HOLIDAYS.map(function (h) {
      var a = dateOf(h.from), b = dateOf(h.to);
      var back = (a.getDay() + 1) % 7, fwd = (7 - b.getDay()) % 7;
      if (back > 2) back = 0;
      if (fwd > 2) fwd = 0;
      return {name: h.name, from: isoAdd(h.from, -back), to: isoAdd(h.to, fwd)};
    });
    return HOLS;
  }
  function holidayOn(iso) { var w = holidayWindows(); for (var i = 0; i < w.length; i++) if (iso >= w[i].from && iso <= w[i].to) return w[i]; return null; }
  function wkSkeleton() {
    return '<div class="wk" id="wk"><div class="wkh"><h4>Flexible on dates? Find your cheapest dates</h4><button class="tbtn" type="button" data-act="wktoggle" id="wkt" aria-expanded="true">Hide</button></div>' +
      '<div class="wkb" id="wkb">' +
        '<p class="hint">We price the cabins you have chosen across every arrival date in the period you pick and show the cheapest. Cabins only: rooms and catering sit on top.</p>' +
        '<div class="wkc">' +
          '<div class="fld"><label for="wkf">Looking between</label><input type="date" id="wkf"></div>' +
          '<div class="fld"><label for="wkto">and</label><input type="date" id="wkto"></div>' +
          '<div class="fld"><label for="wkn">Nights</label><input type="number" id="wkn" min="1" max="30" value="2" style="width:76px"></div>' +
          '<button class="tgo" type="button" id="wkgo" data-act="wkrun">Find cheapest dates</button>' +
        '</div>' +
        '<div class="wkp">' +
          '<div class="wkr"><span class="lab">Quick picks</span><button type="button" class="tbtn" data-act="wkpre" data-k="any">Any dates</button><button type="button" class="tbtn" data-act="wkpre" data-k="weekend">Must be a weekend</button><button type="button" class="tbtn" data-act="wkpre" data-k="weeknights">Weeknights only</button></div>' +
          '<div class="wkr"><span class="lab">Must include</span><span id="wkmust"></span></div>' +
          '<div class="wkr"><span class="lab">Never include</span><span id="wknever"></span></div>' +
          '<div class="wkr"><span class="lab">School holidays</span><button type="button" class="tbtn" data-act="wkhol" data-k="any">Either</button><button type="button" class="tbtn" data-act="wkhol" data-k="in">Inside them</button><button type="button" class="tbtn" data-act="wkhol" data-k="avoid">Avoid them</button><span class="hint" style="margin:0">A Friday night means the night starting Friday</span></div>' +
          '<div class="wks" id="wksum"></div>' +
        '</div>' +
        '<div class="hint" id="wkloaded"></div><div id="wkres"></div>' +
      '</div></div>';
  }
  function mix() { return ROOMS.filter(function (r) { return (S.rooms[r.name] || 0) > 0; }).map(function (r) { return {name: r.name, qty: S.rooms[r.name]}; }); }
  function feasible(n) {
    for (var s = 0; s < 7; s++) {
      var cov = {};
      for (var i = 0; i < n; i++) cov[(s + i) % 7] = true;
      if (WK.must.every(function (d) { return cov[d]; }) && !WK.never.some(function (d) { return cov[d]; })) return true;
    }
    return false;
  }
  function dayNames(list, joiner) {
    return listWords(list.slice().sort(function (a, b) { return DOW_ORDER.indexOf(a) - DOW_ORDER.indexOf(b); }).map(function (d) { return DOW_LONG[d]; }), joiner);
  }
  function wkSync() {
    if (!$('wkmust')) return;
    ['must', 'never'].forEach(function (kind) {
      $('wk' + kind).innerHTML = DOW_ORDER.map(function (d) {
        var on = WK[kind].indexOf(d) >= 0;
        return '<button type="button" class="chip' + (on ? ' ' + kind : '') + '" data-act="wkday" data-kind="' + kind + '" data-d="' + d + '" aria-pressed="' + on + '" title="' + DOW_LONG[d] + ' night">' + DOW[d] + '</button>';
      }).join(' ');
    });
    root.querySelectorAll('[data-act="wkpre"]').forEach(function (b) {
      var p = PRESETS[b.getAttribute('data-k')];
      var on = String(p.must.slice().sort()) === String(WK.must.slice().sort()) && String(p.never.slice().sort()) === String(WK.never.slice().sort());
      b.className = 'tbtn' + (on ? ' on' : '');
    });
    root.querySelectorAll('[data-act="wkhol"]').forEach(function (b) { b.className = 'tbtn' + (b.getAttribute('data-k') === WK.hols ? ' on' : ''); });
    var n = Math.max(1, WK.nights || 2), sum = $('wksum');
    if (!feasible(n)) {
      sum.className = 'wks bad';
      sum.textContent = WK.must.length > n ? 'A ' + n + ' night stay cannot include a ' + dayNames(WK.must) + ' night. Add nights, or take a day out of "must include".'
        : 'No ' + n + ' night stay can include a ' + dayNames(WK.must) + ' night while avoiding ' + dayNames(WK.never, 'or') + ' nights.';
    } else {
      var bits = ['Looking for <b>' + nightWord(n) + '</b>'];
      if (WK.must.length) bits.push('including a <b>' + dayNames(WK.must) + '</b> night');
      if (WK.never.length) bits.push('with no <b>' + dayNames(WK.never, 'or') + '</b> nights');
      if (WK.hols === 'in') bits.push('inside the NSW school holidays');
      if (WK.hols === 'avoid') bits.push('outside the NSW school holidays');
      sum.className = 'wks';
      sum.innerHTML = bits.join(', ') + '.';
    }
    var have = mix().length > 0;
    var go = $('wkgo');
    go.disabled = !have || !feasible(n);
    go.title = !have ? 'Choose your cabins above first' : '';
    var dr = dataRange();
    $('wkloaded').innerHTML = (RATES.range ? 'Live rates loaded for ' + shortY(RATES.range.from) + ' to ' + shortY(RATES.range.to) + '. ' : (dr ? 'Seasonal rates loaded for ' + shortY(dr.from) + ' to ' + shortY(dr.to) + '. ' : '')) +
      (have ? '' : 'Choose your cabins above and we will price that exact mix across the period.');
  }
  function mixCost(fromIso, n) {
    var m = mix();
    if (!m.length) return {cost: null, why: 'none'};
    var total = 0, minStay = 0, fb = false;
    for (var i = 0; i < m.length; i++) {
      var p = stayPricing(m[i].name, fromIso, n);
      if (!p || p.total == null) return {cost: null, why: p ? 'full' : 'noprice'};
      if (p.soldOut || (p.minAvail != null && p.minAvail < m[i].qty)) return {cost: null, why: 'full'};
      if (p.closedArr || p.closedDep) return {cost: null, why: 'closed'};
      if (p.minStay > minStay) minStay = p.minStay;
      if (p.source === 'sheet') fb = true;
      total += p.total * m[i].qty;
    }
    return {cost: total, minStay: minStay, fallback: fb};
  }
  function wkRun() {
    var out = $('wkres');
    var dr = dataRange();
    if (!mix().length) { out.innerHTML = '<div class="wkres"><div class="wkfoot">Choose your cabins above first.</div></div>'; return; }
    if (!dr) { out.innerHTML = '<div class="wkres"><div class="wkfoot">No rate calendar is loaded just now. Please call us on ' + PHONE + '.</div></div>'; return; }
    var n = Math.max(1, WK.nights || 2);
    var f = $('wkf'), t = $('wkto');
    var from = isIso(f.value) ? f.value : dr.from, to = isIso(t.value) ? t.value : dr.to;
    if (from < todayIso()) from = todayIso();
    if (from < dr.from) from = dr.from;
    if (to > dr.to) to = dr.to;
    f.value = from; t.value = to;
    if (from > to) { out.innerHTML = '<div class="wkres"><div class="wkfoot">That period is outside the dates we hold prices for (' + shortY(dr.from) + ' to ' + shortY(dr.to) + ').</div></div>'; return; }
    var found = [], skipped = 0, fb = false;
    for (var d = from; daysBetween(d, to) >= n; d = isoAdd(d, 1)) {
      var cov = {}, hol = 0;
      for (var i = 0; i < n; i++) { var iso = isoAdd(d, i); cov[dateOf(iso).getDay()] = true; if (holidayOn(iso)) hol++; }
      if (!WK.must.every(function (x) { return cov[x]; }) || WK.never.some(function (x) { return cov[x]; })) continue;
      if (WK.hols === 'in' && hol < n) continue;
      if (WK.hols === 'avoid' && hol > 0) continue;
      var c = mixCost(d, n);
      if (c.why === 'full' || c.why === 'closed') { skipped++; continue; }
      if (c.cost == null || c.cost <= 0) continue;
      if (c.fallback) fb = true;
      found.push({from: d, to: isoAdd(d, n), total: c.cost, minStay: c.minStay, hol: holidayOn(d) || holidayOn(isoAdd(d, n - 1))});
    }
    found.sort(function (a, b) { return (a.total - b.total) || (a.from < b.from ? -1 : 1); });
    var picks = [];
    found.forEach(function (x) {
      if (picks.length >= 5) return;
      if (picks.some(function (p) { return x.from < p.to && p.from < x.to; })) return;
      picks.push(x);
    });
    WK.results = picks; WK.skipped = skipped; WK.fallback = fb; WK.ran = true;
    if (!picks.length) {
      out.innerHTML = '<div class="wkres"><div class="wkfoot">Nothing in that period matches. Try wider dates, a different number of nights, or fewer day rules.' +
        (skipped ? ' (' + skipped + ' arrival dates were left out because your cabins are booked out, or arrivals or departures are closed.)' : '') + '</div></div>';
      return;
    }
    var cur = null;
    if (S.arrival) { var cc = mixCost(S.arrival, n); if (cc.cost != null) cur = cc.cost; }
    var h = '<div class="wkres"><div class="wkrh">Cheapest ' + nightWord(n) + ' for the cabins you have chosen' + (cur != null && cur > picks[0].total ? ' · saves up to ' + money(cur - picks[0].total) + ' on your dates' : '') + '</div>';
    picks.forEach(function (p, i) {
      var save = cur != null ? cur - p.total : 0;
      h += '<div class="wkrow"><div><b>' + longDate(p.from) + '</b>' + (i === 0 ? '<span class="wp best">Cheapest</span>' : '') + (p.hol ? '<span class="wp">' + esc(p.hol.name) + '</span>' : '') +
        (p.minStay > n ? '<span class="wp warn">Min ' + p.minStay + ' nights</span>' : '') + '<span class="s">check out ' + dayLabel(p.to) + ' · ' + nightWord(n) + '</span></div>' +
        '<div class="wkcost">' + money(p.total) + (save > 0 ? '<span class="s" style="color:#16a34a;font-weight:600">' + money(save) + ' less than your dates</span>' : '<span class="s">cabins only</span>') + '</div>' +
        '<button class="tbtn tgo2" type="button" data-act="wkuse" data-iso="' + p.from + '" data-n="' + n + '">Use these dates</button></div>';
    });
    h += '<div class="wkfoot">Cabins only: rooms and catering sit on top.' + (skipped ? ' ' + skipped + ' other arrival dates were left out because your cabins are booked out, or arrivals or departures are closed.' : '') +
      (fb ? ' Some of these are priced from our seasonal rate schedule.' : '') + '</div></div>';
    out.innerHTML = h;
  }

  /* ======================================================================
     Sending the enquiry
     ====================================================================== */
  function payload(E) {
    var venuesOld = {'Room 1': 0, 'Room 2': 0, 'Room 3': 0, 'Room 5': 0, 'Marquee': 0, 'Auditorium': 0, 'Dining': 0};
    var venueDays = {}, venueWordsOut = {}, freeVenues = {};
    E.venues.forEach(function (x) {
      var n = x.sp.count;
      if (n <= 0) return;
      venueDays[x.v.key] = x.sp.days;
      venueWordsOut[x.v.key] = x.words;
      if (x.freeWhy) freeVenues[x.v.key] = x.freeWhy;
      if (x.v.key === 'fr13') { venuesOld['Room 1'] += n; venuesOld['Room 2'] += n; venuesOld['Room 3'] += n; }
      else if (x.v.key === 'fr1') venuesOld['Room 1'] += n;
      else if (x.v.key === 'fr2') venuesOld['Room 2'] += n;
      else if (x.v.key === 'fr3') venuesOld['Room 3'] += n;
      else if (x.v.key === 'fr5') venuesOld['Room 5'] += n;
      else if (x.v.key === 'aud') venuesOld['Auditorium'] += n;
      else if (x.v.key === 'marq') venuesOld['Marquee'] += n;
      else if (x.v.key === 'din') venuesOld['Dining'] += n;
    });
    var mealsText = {breakfast: [], lunch: [], dinner: []}, catering = [];
    E.meals.forEach(function (x) {
      if (!x.on || x.days <= 0) return;
      mealsText[x.m.slot].push(x.m.name + ' (' + dayWord(x.days) + ')');
      catering.push({id: x.m.id, name: x.m.name, days: x.days, eaters: E.eaters, covers: x.covers, price: x.m.price, cost: Math.round(x.cost)});
    });
    var churchAccom = E.accom * E.churchPct / 100;
    return {
      token: INTEREST_TOKEN,
      type: 'external-interest',
      v: 2,
      calcVersion: VERSION,
      source: SOURCE,
      submittedAt: new Date().toISOString(),
      contact: {name: val('n'), email: val('e'), mobile: val('m'), group: val('g'), event: val('ev'), dateFirmness: val('fm'), message: val('msgt'), website: val('hpx')},
      stay: {arrival: S.arrival, departure: S.departure, nights: E.nights, guests: S.guests, cabins: E.units},
      cabinTypes: E.cabins.filter(function (c) { return c.qty > 0; }).map(function (c) {
        return {type: c.r.name, id: c.r.id, qty: c.qty, perCabin: c.p ? c.p.total : null, lineTotal: c.p && c.p.total != null ? c.line : null,
                availableAtEstimate: c.p && c.p.minAvail != null ? c.p.minAvail : null, minStay: c.p && c.p.minStay > E.nights ? c.p.minStay : null,
                priceSource: c.p ? c.p.source : ''};
      }),
      meals: {breakfast: mealsText.breakfast.join(', '), lunch: mealsText.lunch.join(', '), dinner: mealsText.dinner.join(', ')},
      mealCovers: E.covers,
      catering: catering,
      who: {adults: E.who.adults, k412: E.who.k412, k13: E.who.k13, babies: E.who.babies, diet: E.who.diet},
      venues: venuesOld,
      venueDays: venueDays,
      venueDayWords: venueWordsOut,
      freeVenues: freeVenues,
      venueAvailability: PUB.availState === 'ok' ? 'checked' : 'not checked',
      venueAvailAsAt: PUB.asAt || '',
      complimentaryConferenceRooms: E.freeRooms,
      church: E.churchPct,
      totals: {
        accommodation: Math.round(E.accom),
        discountPct: E.churchPct,
        discountAmount: Math.round(E.church),
        accommodationAfterDiscount: Math.round(E.accom - churchAccom),
        venue: Math.round(E.venue - (E.venue * E.churchPct / 100)),
        venueBeforeDiscount: Math.round(E.venue),
        meals: Math.round(E.cater),
        grand: Math.round(E.total),
        gst: Math.round(E.gst * 100) / 100,
        deposit: Math.round(E.kd.deposit)
      },
      restrictions: E.restrictions || '',
      flexibleSearch: WK.ran ? String($('wksum').textContent || '').trim() : '',
      ratesAsAt: RATES.status['Last successful update'] || ''
    };
  }
  function sendFail(msg, field) {
    var st = $('sendMsg');
    st.className = 'msg err';
    st.style.marginTop = '10px';
    st.textContent = msg;
    ['f-name', 'f-email'].forEach(function (id) { $(id).classList.remove('bad'); });
    if (field) { $('f-' + field).classList.add('bad'); $(field === 'name' ? 'n' : 'e').focus(); }
  }
  function sendDone(ref) {
    var now = new Date();
    S.sent = {ref: ref, at: now.getDate() + ' ' + MON[now.getMonth()] + ' ' + now.getFullYear() + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes())};
    /* the form is hidden, not removed: the estimate above still reads their details from it */
    $('eiForm').hidden = true;
    $('eiDone').hidden = false;
    $('eiDone').innerHTML = '<div class="done"><h4>Thanks, we have got that.</h4><p>Your estimate is with our functions team and someone will be in touch, usually within one business day. Nothing is held until we confirm it with you.' +
      '<br><b>Reference ' + esc(ref) + '</b><br><br>In a hurry? Call us on <b>' + PHONE + '</b>. You can still print or save your estimate above.</p></div>';
    update();
    $('tracker').scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  function send() {
    var btn = $('send');
    var name = val('n'), email = val('e');
    if (!name) return sendFail('Please tell us your name so we know who to reply to.', 'name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return sendFail('Please enter an email address we can reply to.', 'email');
    var E = estimate();
    if (!E.nights) return sendFail('Please choose your check-in and check-out dates above first.');
    ['f-name', 'f-email'].forEach(function (id) { $(id).classList.remove('bad'); });
    btn.disabled = true;
    var st = $('sendMsg');
    st.className = 'hint'; st.style.marginTop = '10px';
    st.textContent = 'Sending your estimate…';
    fetch(ENDPOINT, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(payload(E))})
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) {
        var j = null;
        try { j = JSON.parse(text); } catch (e) {}
        /* only say we have it when the server wrote the row and gave a reference */
        if (!j || j.ok !== true || !j.ref) throw new Error((j && j.error) || 'no reference');
        sendDone(j.ref);
      })
      .catch(function () {
        btn.disabled = false;
        sendFail('Sorry, we could not send that just now. Please call us on ' + PHONE + ', or use the email link below and your estimate will come through that way.');
      });
  }

  /* plain text of the estimate, for the email link */
  function textEstimate(E) {
    var L = ['WSLR group estimate', ''];
    [['Name', val('n')], ['Email', val('e')], ['Mobile', val('m')], ['Group', val('g')], ['Event type', val('ev')], ['Dates', val('fm')]].forEach(function (r) { if (r[1]) L.push(r[0] + ': ' + r[1]); });
    L.push('');
    L.push('Check-in: ' + (S.arrival ? longDate(S.arrival) : '-'));
    L.push('Check-out: ' + (S.departure ? longDate(S.departure) : '-'));
    L.push('Nights: ' + E.nights + '   People: ' + (S.guests || '-'));
    if (E.restrictions) L.push('Booking system note: ' + E.restrictions);
    var cab = E.cabins.filter(function (c) { return c.qty > 0; });
    if (cab.length) {
      L.push('', 'ACCOMMODATION');
      cab.forEach(function (c) { L.push('  ' + c.qty + ' x ' + c.r.name + (c.p && c.p.total != null ? ' at ' + money(c.p.total) + ' per cabin = ' + money(c.line) : '')); });
    }
    var ven = E.venues.filter(function (x) { return x.sp.count > 0; });
    if (ven.length) {
      L.push('', 'CONFERENCE ROOMS');
      ven.forEach(function (x) { L.push('  ' + x.v.name + ': ' + x.words + ' = ' + (x.freeWhy ? 'included ' + x.freeWhy : money(x.cost))); });
    }
    var ml = E.meals.filter(function (x) { return x.on && x.days > 0; });
    if (ml.length) {
      L.push('', 'CATERING (' + E.eaters + ' people: ' + E.who.adults + ' adults' + (E.who.k412 ? ', ' + E.who.k412 + ' aged 4-12' : '') + (E.who.k13 ? ', ' + E.who.k13 + ' aged 1-3' : '') + (E.who.babies ? ', ' + E.who.babies + ' under 1' : '') + (E.who.diet ? ', ' + E.who.diet + ' special diets' : '') + ')');
      ml.forEach(function (x) { L.push('  ' + x.m.name + ' x ' + dayWord(x.days) + ' = ' + money(x.cost)); });
    }
    if (E.churchPct) L.push('', 'DISCOUNT: ' + E.churchPct + '% church / charitable on accommodation and venue hire (subject to approval): -' + money(E.church));
    L.push('', 'ESTIMATED TOTAL: ' + money(E.total) + ' inc GST (an estimate only)');
    if (E.kd.deposit) L.push('Deposit: ' + money(E.kd.deposit));
    if (RATES.status['Last successful update']) L.push('Cabin rates from our booking system, ' + RATES.status['Last successful update']);
    if (val('msgt')) L.push('', 'NOTES:', '  ' + val('msgt'));
    L.push('', 'Please confirm availability and send a formal quote.');
    return L.join('\n');
  }
  function mailto() {
    var E = estimate();
    var subject = 'Group estimate - ' + (S.guests || '?') + ' people, ' + nightWord(E.nights) + (S.arrival ? ' from ' + shortY(S.arrival) : '');
    var body = textEstimate(E);
    if (body.length > 1800) body = body.slice(0, 1780) + '\n...(shortened)';
    window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function printEstimate() {
    var E = estimate();
    var w = window.open('', '_blank');
    if (!w) { window.print(); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>WSLR group estimate</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:18px;color:#000}' +
      'h1{font-size:18px;margin:0 0 4px;color:#0f2d4a}p{font-size:12px;margin:0 0 12px;color:#444}' + TRACKER_CSS() +
      '.tk-g{grid-template-columns:repeat(auto-fill,minmax(105px,1fr))}@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>' +
      '<h1>Wollongong Surf Leisure Resort · group estimate</h1><p>201 Pioneer Rd, Fairy Meadow NSW 2519 · ' + PHONE + ' · ' + EMAIL + ' · printed ' + new Date().toLocaleDateString('en-AU') +
      '. An estimate only: availability and prices are confirmed in our formal quote.</p>' + trackerHTML(E, true) + '</body></html>');
    w.document.close();
    w.focus();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
  }

  /* ======================================================================
     Wiring
     ====================================================================== */
  var SOURCE = 'estimate-calculator';
  function wire() {
    $('arr').addEventListener('change', function () { datesChanged('arr'); });
    $('dep').addEventListener('change', function () { datesChanged('dep'); });
    $('ppl').addEventListener('input', function () { S.guests = num(this.value); update(); });
    var whoMap = {wA: 'adults', wK: 'k412', wT: 'k13', wB: 'babies', wD: 'diet'};
    Object.keys(whoMap).forEach(function (id) {
      $(id).addEventListener('input', function () {
        var k = whoMap[id];
        if (k === 'adults' && this.value === '') S.who.adults = null;
        else S.who[k] = num(this.value);
        update();
      });
    });
    ['n', 'e', 'm', 'g', 'ev', 'msgt'].forEach(function (id) {
      $(id).addEventListener('input', function () { if (LAST) $('tracker').innerHTML = trackerHTML(LAST); });
      $(id).addEventListener('change', function () { if (LAST) $('tracker').innerHTML = trackerHTML(LAST); });
    });
    $('send').addEventListener('click', send);
    $('print').addEventListener('click', printEstimate);
    $('mailto').addEventListener('click', function (ev) { ev.preventDefault(); mailto(); });
    $('wkn').addEventListener('input', function () { WK.nights = Math.max(1, Math.min(30, num(this.value) || 1)); WK.nightsTouched = true; wkSync(); });
    $('wkf').addEventListener('change', wkSync);
    $('wkto').addEventListener('change', wkSync);
    root.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!t || t.disabled) return;
      var act = t.getAttribute('data-act'), k = t.getAttribute('data-k');
      if (act === 'cab') stepCabin(k, Number(t.getAttribute('data-d')));
      else if (act === 'vday') cycleVenueDay(k, t.getAttribute('data-iso'));
      else if (act === 'mdays') stepMealDays(k, Number(t.getAttribute('data-d')));
      else if (act === 'extend') { var n = Number(t.getAttribute('data-n')); S.lastNights = n; $('dep').value = isoAdd(S.arrival, n); datesChanged('arr'); }
      else if (act === 'wktoggle') { WK.open = !WK.open; $('wkb').hidden = !WK.open; t.textContent = WK.open ? 'Hide' : 'Show'; t.setAttribute('aria-expanded', String(WK.open)); }
      else if (act === 'wkrun') wkRun();
      else if (act === 'wkpre') {
        var p = PRESETS[k]; WK.must = p.must.slice(); WK.never = p.never.slice();
        if (WK.nights < p.min) { WK.nights = p.min; WK.nightsTouched = true; $('wkn').value = WK.nights; }
        wkSync(); if (WK.ran) wkRun();
      } else if (act === 'wkhol') { WK.hols = k; wkSync(); if (WK.ran) wkRun(); }
      else if (act === 'wkday') {
        var kind = t.getAttribute('data-kind'), d = Number(t.getAttribute('data-d')), other = kind === 'must' ? 'never' : 'must';
        var i = WK[kind].indexOf(d);
        if (i >= 0) WK[kind].splice(i, 1); else { WK[kind].push(d); var j = WK[other].indexOf(d); if (j >= 0) WK[other].splice(j, 1); }
        wkSync(); if (WK.ran) wkRun();
      } else if (act === 'wkuse') {
        var iso = t.getAttribute('data-iso'), nn = Number(t.getAttribute('data-n'));
        S.lastNights = nn; $('arr').value = iso; $('dep').value = isoAdd(iso, nn); datesChanged('arr');
        $('cabins').scrollIntoView({behavior: 'smooth', block: 'center'});
      }
    });
    root.addEventListener('change', function (ev) {
      var t = ev.target, act = t.getAttribute && t.getAttribute('data-act');
      if (act === 'meal') toggleMeal(t.getAttribute('data-k'), t.checked);
      else if (act === 'church') { S.church = Number(t.value) || 0; update(); }
    });
  }

  function loadRates() {
    return Promise.all([
      fetchGviz('RMS_Rates').then(parseRmsRates).catch(function () {}),
      fetchGviz('RMS_Status').then(parseRmsStatus).catch(function () {}),
      fetchGviz('Rates').then(parseFallback).catch(function () {})
    ]).then(function () {
      RATES.loaded = true;
      RATES.failed = !RATES.range && !RATES.fallback.length;
      var t = todayIso(), dr = dataRange();
      var a = $('arr'), d = $('dep');
      a.min = t; d.min = isoAdd(t, 1);
      if (dr) { a.max = dr.to; d.max = isoAdd(dr.to, 1); }
      var f = $('wkf'), to = $('wkto');
      f.value = t; f.min = t;
      var yr = isoAdd(t, 365);
      to.value = dr && yr > dr.to ? dr.to : yr; to.min = isoAdd(t, 1);
      if (dr) { f.max = dr.to; to.max = dr.to; }
      if (RATES.failed) { var wk = $('wk'); if (wk) wk.hidden = true; }
      update();
    });
  }

  function mount(host) {
    if (host.__wslrCalc) return;
    host.__wslrCalc = true;
    SOURCE = host.getAttribute('data-source') || SOURCE;
    /* fonts are declared on the page itself: a shadow root cannot load @font-face */
    if (!document.querySelector('link[data-wslr-fonts]')) {
      var lk = document.createElement('link');
      lk.rel = 'stylesheet';
      lk.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Open+Sans:wght@400;600;700&display=swap';
      lk.setAttribute('data-wslr-fonts', '1');
      document.head.appendChild(lk);
    }
    root = host.attachShadow ? host.attachShadow({mode: 'open'}) : host;
    root.innerHTML = '<style>' + CSS + '</style>' + skeleton();
    if (!root.getElementById) root.getElementById = function (id) { return host.querySelector('#' + id); };
    wire();
    update();
    loadRates();
    loadPrices();
    window.WSLR_CALC = {version: VERSION, state: S, estimate: estimate, payload: function () { return payload(estimate()); }};
  }

  function boot() {
    var host = document.getElementById('wslr-calc') || document.querySelector('[data-wslr-calc]');
    if (host) mount(host);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
