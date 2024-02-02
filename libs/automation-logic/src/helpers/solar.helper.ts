/* eslint-disable @typescript-eslint/no-magic-numbers */

//
// NOTE: This file is `sun.js` from the `solar-calc` library, with some light tweaks
// This code wasn't built with modern types in mind, and has some weird interactions in places.
// It accomplishes what I need, and as long as I don't look at it, it can't hurt me
// See the solar-calc extension for the rest of the implementation
//

const formatDate = function formatDate(date, minutes) {
  const seconds = (minutes - Math.floor(minutes)) * 60;
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      minutes,
      seconds,
    ),
  );
};

function calcTimeJulianCent(jd) {
  const T = (jd - 2_451_545) / 36_525;
  return T;
}

function isLeapYear(yr) {
  return (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
}

function calcDoyFromJD(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let A;
  if (z < 2_299_161) {
    A = z;
  } else {
    const alpha = Math.floor((z - 1_867_216.25) / 36_524.25);
    A = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const day = B - D - Math.floor(30.6001 * E) + f;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  const k = isLeapYear(year) ? 1 : 2;
  const doy =
    Math.floor((275 * month) / 9) - k * Math.floor((month + 9) / 12) + day - 30;
  return doy;
}

function radToDeg(angleRad) {
  return (180 * angleRad) / Math.PI;
}

function degToRad(angleDeg) {
  return (Math.PI * angleDeg) / 180;
}

function calcGeomMeanLongSun(t) {
  let L0 = 280.466_46 + t * (36_000.769_83 + t * 0.000_303_2);
  while (L0 > 360) {
    L0 -= 360;
  }
  while (L0 < 0) {
    L0 += 360;
  }
  return L0; // in degrees
}

function calcGeomMeanAnomalySun(t) {
  const M = 357.529_11 + t * (35_999.050_29 - 0.000_153_7 * t);
  return M; // in degrees
}

function calcEccentricityEarthOrbit(t) {
  const e = 0.016_708_634 - t * (0.000_042_037 + 1.267e-7 * t);
  return e; // unitless
}

function calcSunEqOfCenter(t) {
  const m = calcGeomMeanAnomalySun(t);
  const mrad = degToRad(m);
  const sinm = Math.sin(mrad);
  const sin2m = Math.sin(mrad + mrad);
  const sin3m = Math.sin(mrad + mrad + mrad);
  const C =
    sinm * (1.914_602 - t * (0.004_817 + 0.000_014 * t)) +
    sin2m * (0.019_993 - 0.000_101 * t) +
    sin3m * 0.000_289;
  return C; // in degrees
}

function calcSunTrueLong(t) {
  const l0 = calcGeomMeanLongSun(t);
  const c = calcSunEqOfCenter(t);
  const O = l0 + c;
  return O; // in degrees
}

function calcSunApparentLong(t) {
  const o = calcSunTrueLong(t);
  const omega = 125.04 - 1934.136 * t;
  const lambda = o - 0.005_69 - 0.004_78 * Math.sin(degToRad(omega));
  return lambda; // in degrees
}

function calcMeanObliquityOfEcliptic(t) {
  const seconds = 21.448 - t * (46.815 + t * (0.000_59 - t * 0.001_813));
  const e0 = 23 + (26 + seconds / 60) / 60;
  return e0; // in degrees
}

function calcObliquityCorrection(t) {
  const e0 = calcMeanObliquityOfEcliptic(t);
  const omega = 125.04 - 1934.136 * t;
  const e = e0 + 0.002_56 * Math.cos(degToRad(omega));
  return e; // in degrees
}

function calcSunDeclination(t) {
  const e = calcObliquityCorrection(t);
  const lambda = calcSunApparentLong(t);

  const sint = Math.sin(degToRad(e)) * Math.sin(degToRad(lambda));
  const theta = radToDeg(Math.asin(sint));
  return theta; // in degrees
}

function calcEquationOfTime(t) {
  const epsilon = calcObliquityCorrection(t);
  const l0 = calcGeomMeanLongSun(t);
  const e = calcEccentricityEarthOrbit(t);
  const m = calcGeomMeanAnomalySun(t);

  let y = Math.tan(degToRad(epsilon) / 2);
  y *= y;

  const sin2l0 = Math.sin(2 * degToRad(l0));
  const sinm = Math.sin(degToRad(m));
  const cos2l0 = Math.cos(2 * degToRad(l0));
  const sin4l0 = Math.sin(4 * degToRad(l0));
  const sin2m = Math.sin(2 * degToRad(m));

  const Etime =
    y * sin2l0 -
    2 * e * sinm +
    4 * e * y * sinm * cos2l0 -
    0.5 * y * y * sin4l0 -
    1.25 * e * e * sin2m;
  return radToDeg(Etime) * 4; // in minutes of time
}

function calcHourAngle(angle, lat, solarDec) {
  const latRad = degToRad(lat);
  const sdRad = degToRad(solarDec);
  const HAarg =
    Math.cos(degToRad(90 + angle)) / (Math.cos(latRad) * Math.cos(sdRad)) -
    Math.tan(latRad) * Math.tan(sdRad);
  const HA = Math.acos(HAarg);
  return HA; // in radians (for sunset, use -HA)
}

function isNumber(inputValue) {
  let oneDecimal = false;
  const inputString = "" + inputValue;
  for (let i = 0; i < inputString.length; i++) {
    const oneChar = inputString.charAt(i);
    if (i === 0 && (oneChar === "-" || oneChar === "+")) {
      continue;
    }
    if (oneChar === "." && !oneDecimal) {
      oneDecimal = true;
      continue;
    }
    if (oneChar < "0" || oneChar > "9") {
      return false;
    }
  }
  return true;
}

export function getJD(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD =
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    B -
    1524.5;
  return JD;
}

export function calcSolNoon(longitude: number) {
  const date = new Date();
  const jd = getJD(date);
  const noon = calcTimeJulianCent(jd - longitude / 360);
  let eqTime = calcEquationOfTime(noon);
  const solNoonOffset = 720 - longitude * 4 - eqTime; // in minutes
  const newt = calcTimeJulianCent(jd + solNoonOffset / 1440);
  eqTime = calcEquationOfTime(newt);
  let solNoonLocal = 720 - longitude * 4 - eqTime; // in minutes
  while (solNoonLocal < 0) {
    solNoonLocal += 1440;
  }
  while (solNoonLocal >= 1440) {
    solNoonLocal -= 1440;
  }
  return formatDate(date, solNoonLocal);
  // return timeString(solNoonLocal, 3);
}

function dayString(jd) {
  if (jd < 900_000 || jd > 2_817_000) {
    return "error";
  } else {
    const z = Math.floor(jd + 0.5);
    const f = jd + 0.5 - z;
    let A;
    if (z < 2_299_161) {
      A = z;
    } else {
      const alpha = Math.floor((z - 1_867_216.25) / 36_524.25);
      A = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E) + f;
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  }
}

function calcSunriseSetUTC(rise, angle, JD, latitude, longitude) {
  const t = calcTimeJulianCent(JD);
  const eqTime = calcEquationOfTime(t);
  const solarDec = calcSunDeclination(t);
  let hourAngle = calcHourAngle(angle, latitude, solarDec);
  //alert("HA = " + radToDeg(hourAngle));
  if (!rise) hourAngle = -hourAngle;
  const delta = longitude + radToDeg(hourAngle);
  const timeUTC = 720 - 4 * delta - eqTime; // in minutes
  return timeUTC;
}

export function calcSunriseSet(
  rise: boolean,
  angle: number,
  latitude: number,
  longitude: number,
) {
  const date = new Date();
  const JD = getJD(date);
  // rise = 1 for sunrise, 0 for sunset
  const timeUTC = calcSunriseSetUTC(rise, angle, JD, latitude, longitude);
  const newTimeUTC = calcSunriseSetUTC(
    rise,
    angle,
    JD + timeUTC / 1440,
    latitude,
    longitude,
  );
  if (isNumber(newTimeUTC)) {
    return formatDate(date, newTimeUTC);
  } else {
    // no sunrise/set found
    const doy = calcDoyFromJD(JD);
    let jdy;
    if (
      (latitude > 66.4 && doy > 79 && doy < 267) ||
      (latitude < -66.4 && (doy < 83 || doy > 263))
    ) {
      //previous sunrise/next sunset
      jdy = calcJDofNextPreviousRiseSet(
        !rise,
        rise,
        angle,
        JD,
        latitude,
        longitude,
      );
      return dayString(jdy);
    } else {
      //previous sunset/next sunrise
      jdy = calcJDofNextPreviousRiseSet(
        rise,
        rise,
        angle,
        JD,
        latitude,
        longitude,
      );
      return dayString(jdy);
    }
  }
}

function calcJDofNextPreviousRiseSet(
  next,
  rise,
  type,
  JD,
  latitude,
  longitude,
) {
  let julianday = JD;
  const increment = next ? 1 : -1;

  let time = calcSunriseSetUTC(rise, type, julianday, latitude, longitude);
  while (!isNumber(time)) {
    julianday += increment;
    time = calcSunriseSetUTC(rise, type, julianday, latitude, longitude);
  }

  return julianday;
}
