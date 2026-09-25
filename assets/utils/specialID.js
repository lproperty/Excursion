// Turns a stop or service ID into a number (MapLibre feature IDs must be
// numeric) by concatenating each character's code, e.g. '10e' → 4948101
export const encode = (id) =>
  parseInt(
    id.replace(/\w/gi, (c) => '' + c.charCodeAt()),
    10,
  );

// Codes for word characters are 48–99 (two digits, never starting with 1) or
// 100–122 (three digits, always starting with 1), so a leading 1 means a
// three-digit code
export const decode = (number) =>
  String.fromCharCode(...('' + number).match(/1\d\d|\d\d/g));
