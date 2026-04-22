/**
 * Galactic Calendar utility (Year 4 IE / 7981 C.R.C. / ~16 BBY)
 *
 * Epoch convention:
 *   - Year 1 IE Day 1 == absolute dayIndex 0
 *   - Year 1 IE     == 19 BBY     == 7978 C.R.C.
 *   - Year N IE     == (20 - N) BBY (strict; the ~15 BBY in design notes
 *                                     is colloquial — Year 4 IE is 16 BBY
 *                                     by strict ledger and renders as such)
 *   - Year N IE     == (7977 + N) C.R.C.
 *
 * Year structure (368 days):
 *   - Months 1..10 of 35 days  -> days  1..350
 *   - Fete Week                -> days 351..365 (15 days)
 *   - 3 standalone festival days -> days 366..368
 *
 * 5-day week (Primeday, Centaxday, Taungsday, Zhellday, Benduday).
 * Anchor: campaign default day (4 Elona, Year 4 IE = absolute dayIndex 1107)
 * is a Primeday. All weekday math is derived from this anchor.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GalacticCalendar = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WEEKDAYS = ['Primeday', 'Centaxday', 'Taungsday', 'Zhellday', 'Benduday'];
  var MONTHS = [
    'Elona', 'Kelona', 'Selona', 'Telona', 'Nelona',
    'Helona', 'Melona', 'Yelona', 'Relona', 'Welona'
  ];
  var DAYS_PER_MONTH = 35;
  var MONTHS_PER_YEAR = 10;
  var FETE_DAYS = 15;
  var STANDALONE_DAYS = 3;
  var DAYS_PER_YEAR = MONTHS_PER_YEAR * DAYS_PER_MONTH + FETE_DAYS + STANDALONE_DAYS; // 368

  // Campaign anchor: Primeday, 4 Elona, Year 4 IE -> dayIndex 1107.
  var CAMPAIGN_ANCHOR_DAY_INDEX = (4 - 1) * DAYS_PER_YEAR + (4 - 1); // 3*368+3 = 1107
  var CAMPAIGN_ANCHOR_WEEKDAY_INDEX = 0; // Primeday

  // weekday(d) = WEEKDAYS[(d - anchor) mod 5]
  function weekdayIndex(dayIndex) {
    var diff = ((dayIndex - CAMPAIGN_ANCHOR_DAY_INDEX) % 5 + 5) % 5;
    return (CAMPAIGN_ANCHOR_WEEKDAY_INDEX + diff) % 5;
  }
  function weekdayName(dayIndex) {
    return WEEKDAYS[weekdayIndex(dayIndex)];
  }

  // dayIndex -> {year, month (1..10), day (1..35), isFete, feteDay (1..15),
  //              isStandalone, standaloneDay (1..3), dayOfYear (1..368)}
  function dateFromDayIndex(dayIndex) {
    var year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
    var doy = (dayIndex % DAYS_PER_YEAR + DAYS_PER_YEAR) % DAYS_PER_YEAR + 1; // 1..368
    if (doy <= MONTHS_PER_YEAR * DAYS_PER_MONTH) {
      var month = Math.floor((doy - 1) / DAYS_PER_MONTH) + 1;
      var day = ((doy - 1) % DAYS_PER_MONTH) + 1;
      return { year: year, month: month, day: day, dayOfYear: doy,
               isFete: false, isStandalone: false };
    }
    if (doy <= MONTHS_PER_YEAR * DAYS_PER_MONTH + FETE_DAYS) {
      return { year: year, month: null, day: null, dayOfYear: doy,
               isFete: true, feteDay: doy - MONTHS_PER_YEAR * DAYS_PER_MONTH,
               isStandalone: false };
    }
    return { year: year, month: null, day: null, dayOfYear: doy,
             isFete: false, isStandalone: true,
             standaloneDay: doy - MONTHS_PER_YEAR * DAYS_PER_MONTH - FETE_DAYS };
  }

  // {year, month, day} -> dayIndex (0-based since Y1 d1).
  function dayIndexFromDate(date) {
    var y = (date.year != null) ? date.year : 4;
    var yearStart = (y - 1) * DAYS_PER_YEAR;
    if (date.isFete) {
      var fd = date.feteDay != null ? date.feteDay : 1;
      return yearStart + MONTHS_PER_YEAR * DAYS_PER_MONTH + (fd - 1);
    }
    if (date.isStandalone) {
      var sd = date.standaloneDay != null ? date.standaloneDay : 1;
      return yearStart + MONTHS_PER_YEAR * DAYS_PER_MONTH + FETE_DAYS + (sd - 1);
    }
    var m = (date.month != null) ? date.month : 1;
    var d = (date.day != null) ? date.day : 1;
    return yearStart + (m - 1) * DAYS_PER_MONTH + (d - 1);
  }

  function bbyForYear(year) {
    // Year 1 IE = 19 BBY; Year N IE = 20 - N.
    return 20 - year;
  }
  function crcForYear(year) {
    return 7977 + year;
  }

  function _monthShorthand(month) {
    if (!month) return '';
    if (month <= 3) return 'early-' + MONTHS[month - 1];
    if (month <= 7) return 'mid-' + MONTHS[month - 1];
    return 'late-' + MONTHS[month - 1];
  }

  // Imperial dialect: "Day 4, Month 1, Year 4 (Primeday)"
  function formatImperial(dayIndex, opts) {
    var dt = dateFromDayIndex(dayIndex);
    var wd = weekdayName(dayIndex);
    if (dt.isFete) {
      return 'Fete Week, Day ' + dt.feteDay + ', Year ' + dt.year + ' (' + wd + ')';
    }
    if (dt.isStandalone) {
      return 'Festival Day ' + dt.standaloneDay + ', Year ' + dt.year + ' (' + wd + ')';
    }
    var s = 'Day ' + dt.day + ', Month ' + dt.month + ', Year ' + dt.year;
    if (!opts || opts.weekday !== false) s += ' (' + wd + ')';
    return s;
  }

  // C.R.C. + Tapani: "4 Elona, 7981 C.R.C. (Primeday)"
  function formatCRCTapani(dayIndex, opts) {
    var dt = dateFromDayIndex(dayIndex);
    var wd = weekdayName(dayIndex);
    var crc = crcForYear(dt.year);
    if (dt.isFete) {
      return 'Fete Week Day ' + dt.feteDay + ', ' + crc + ' C.R.C. (' + wd + ')';
    }
    if (dt.isStandalone) {
      return 'Festival Day ' + dt.standaloneDay + ', ' + crc + ' C.R.C. (' + wd + ')';
    }
    var s = dt.day + ' ' + MONTHS[dt.month - 1] + ', ' + crc + ' C.R.C.';
    if (!opts || opts.weekday !== false) s += ' (' + wd + ')';
    return s;
  }

  // Citizen voice: "a Primeday in early-Elona"
  function formatCitizen(dayIndex) {
    var dt = dateFromDayIndex(dayIndex);
    var wd = weekdayName(dayIndex);
    if (dt.isFete) return 'a ' + wd + ' in Fete Week';
    if (dt.isStandalone) return 'a Festival ' + wd;
    return 'a ' + wd + ' in ' + _monthShorthand(dt.month);
  }

  // Scholar voice: "the 4th of the first month, 7981 C.R.C."
  var ORDINAL_MONTH = ['first','second','third','fourth','fifth',
                       'sixth','seventh','eighth','ninth','tenth'];
  function _ord(n) {
    var s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function formatScholar(dayIndex) {
    var dt = dateFromDayIndex(dayIndex);
    var crc = crcForYear(dt.year);
    if (dt.isFete) return 'a Fete Week day, ' + crc + ' C.R.C.';
    if (dt.isStandalone) return 'a festival day, ' + crc + ' C.R.C.';
    return 'the ' + _ord(dt.day) + ' of the ' + ORDINAL_MONTH[dt.month - 1] +
           ' month, ' + crc + ' C.R.C.';
  }

  // Hutt voice: festival-cycle / Boonta-relative phrasing.
  function formatHutt(dayIndex) {
    var dt = dateFromDayIndex(dayIndex);
    if (dt.isFete) return 'mid-festival, year ' + crcForYear(dt.year);
    if (dt.isStandalone) return 'a feast-day, year ' + crcForYear(dt.year);
    // Boonta Eve = 14 Yelona (month 8). Compute days-until / since.
    var boonta = (dt.year - 1) * DAYS_PER_YEAR + (8 - 1) * DAYS_PER_MONTH + 13;
    var diff = boonta - dayIndex;
    if (diff > 0 && diff <= 30) return diff + ' days before Boonta';
    if (diff < 0 && diff >= -30) return Math.abs(diff) + ' days past Boonta';
    return _monthShorthand(dt.month) + ', year ' + crcForYear(dt.year);
  }

  // GM-only footnote.
  function formatBBY(dayIndex) {
    var dt = dateFromDayIndex(dayIndex);
    return '~' + bbyForYear(dt.year) + ' BBY';
  }

  // Hour formatter (24-hour standard galactic time).
  function formatHour(hour) {
    if (hour == null) return '';
    var h = ((hour % 24) + 24) % 24;
    var hh = (h < 10 ? '0' : '') + h;
    return hh + ':00';
  }

  // Pick voice by string key.
  function format(dayIndex, voice, opts) {
    switch (voice) {
      case 'imperial': return formatImperial(dayIndex, opts);
      case 'crc':
      case 'tapani':
      case 'citizen-formal': return formatCRCTapani(dayIndex, opts);
      case 'citizen': return formatCitizen(dayIndex);
      case 'scholar': return formatScholar(dayIndex);
      case 'hutt': return formatHutt(dayIndex);
      case 'bby': return formatBBY(dayIndex);
      default: return formatCitizen(dayIndex);
    }
  }

  // All renderings at once — handy for the GM widget and the API response.
  function renderAll(dayIndex, hour) {
    var dt = dateFromDayIndex(dayIndex);
    return {
      dayIndex: dayIndex,
      hour: hour == null ? 0 : hour,
      year: dt.year,
      month: dt.month,
      day: dt.day,
      dayOfYear: dt.dayOfYear,
      isFete: !!dt.isFete,
      feteDay: dt.feteDay || null,
      isStandalone: !!dt.isStandalone,
      standaloneDay: dt.standaloneDay || null,
      weekday: weekdayName(dayIndex),
      weekdayIndex: weekdayIndex(dayIndex),
      monthName: dt.month ? MONTHS[dt.month - 1] : null,
      crcYear: crcForYear(dt.year),
      bby: bbyForYear(dt.year),
      time: formatHour(hour == null ? 0 : hour),
      imperial: formatImperial(dayIndex),
      crcTapani: formatCRCTapani(dayIndex),
      citizen: formatCitizen(dayIndex),
      scholar: formatScholar(dayIndex),
      hutt: formatHutt(dayIndex),
      bbyFootnote: formatBBY(dayIndex)
    };
  }

  // Advance helpers (hours roll into days).
  function advance(state, deltaHours, deltaDays) {
    var h = (state.hour || 0) + (deltaHours || 0);
    var d = (state.dayIndex || 0) + (deltaDays || 0);
    while (h >= 24) { h -= 24; d += 1; }
    while (h < 0)   { h += 24; d -= 1; }
    return { dayIndex: d, hour: h };
  }

  // Parse an Imperial-dialect date string back into a dayIndex.
  // Accepted forms:
  //   "Primeday, 4 Elona, Year 4"
  //   "4 Elona, Year 4"
  //   "Day 4, Month 5, Year 4"
  //   "Day 4, Month 5, Year 4 (Primeday)"
  //   "Fete Week, Day 2, Year 4"        / "Fete Week Day 2, Year 4"
  //   "Festival Day 1, Year 4"
  // Returns { dayIndex, hour } or null on failure. hour defaults to 8.
  function parseImperialString(str) {
    if (!str || typeof str !== 'string') return null;
    var s = str.trim();
    var m;
    // Fete Week
    m = s.match(/Fete\s+Week[,\s]+Day\s+(\d+)[,\s]+Year\s+(-?\d+)/i);
    if (m) {
      try {
        return { dayIndex: dayIndexFromDate({ year: +m[2], isFete: true, feteDay: +m[1] }), hour: 8 };
      } catch (e) { return null; }
    }
    // Festival Day (standalone)
    m = s.match(/Festival\s+Day\s+(\d+)[,\s]+Year\s+(-?\d+)/i);
    if (m) {
      try {
        return { dayIndex: dayIndexFromDate({ year: +m[2], isStandalone: true, standaloneDay: +m[1] }), hour: 8 };
      } catch (e) { return null; }
    }
    // "Day D, Month M, Year Y"
    m = s.match(/Day\s+(\d+)[,\s]+Month\s+(\d+)[,\s]+Year\s+(-?\d+)/i);
    if (m) {
      try {
        return { dayIndex: dayIndexFromDate({ year: +m[3], month: +m[2], day: +m[1] }), hour: 8 };
      } catch (e) { return null; }
    }
    // "[Weekday, ]D MonthName, Year Y"
    m = s.match(/(?:[A-Za-z]+day,\s+)?(\d+)\s+([A-Za-z]+)[,\s]+Year\s+(-?\d+)/i);
    if (m) {
      var monthIdx = -1;
      var name = m[2].toLowerCase();
      for (var i = 0; i < MONTHS.length; i++) {
        if (MONTHS[i].toLowerCase() === name) { monthIdx = i; break; }
      }
      if (monthIdx >= 0) {
        try {
          return { dayIndex: dayIndexFromDate({ year: +m[3], month: monthIdx + 1, day: +m[1] }), hour: 8 };
        } catch (e) { return null; }
      }
    }
    return null;
  }

  return {
    WEEKDAYS: WEEKDAYS.slice(),
    MONTHS: MONTHS.slice(),
    DAYS_PER_MONTH: DAYS_PER_MONTH,
    MONTHS_PER_YEAR: MONTHS_PER_YEAR,
    FETE_DAYS: FETE_DAYS,
    STANDALONE_DAYS: STANDALONE_DAYS,
    DAYS_PER_YEAR: DAYS_PER_YEAR,
    CAMPAIGN_ANCHOR_DAY_INDEX: CAMPAIGN_ANCHOR_DAY_INDEX,
    weekdayIndex: weekdayIndex,
    weekdayName: weekdayName,
    dateFromDayIndex: dateFromDayIndex,
    dayIndexFromDate: dayIndexFromDate,
    bbyForYear: bbyForYear,
    crcForYear: crcForYear,
    formatImperial: formatImperial,
    parseImperialString: parseImperialString,
    formatCRCTapani: formatCRCTapani,
    formatCitizen: formatCitizen,
    formatScholar: formatScholar,
    formatHutt: formatHutt,
    formatBBY: formatBBY,
    formatHour: formatHour,
    format: format,
    renderAll: renderAll,
    advance: advance
  };
}));
