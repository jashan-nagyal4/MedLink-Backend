function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}
function isCoordinate(value, min, max) {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) && n >= min && n <= max;
}
module.exports = { isPositiveInteger, isCoordinate };
