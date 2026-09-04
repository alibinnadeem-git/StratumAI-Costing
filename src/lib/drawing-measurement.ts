export type CalibrationSnapshot = {
  id: string;
  scaleFactor: number;
  realUnit: string;
};

export type Point = { x: number; y: number };

const FEET_PER_UNIT: Record<string, number> = {
  FT: 1,
  IN: 1 / 12,
  M: 3.280839895013123,
  MM: 0.003280839895013123,
};

export function normalizedFeetPerDrawingUnit(calibration: CalibrationSnapshot) {
  const factor = FEET_PER_UNIT[calibration.realUnit.toUpperCase()];
  if (!factor) throw new Error(`Unsupported calibration unit ${calibration.realUnit}.`);
  return calibration.scaleFactor * factor;
}

export function lineRawMeasurement(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function rectangleRawArea(a: Point, b: Point) {
  return Math.abs((b.x - a.x) * (b.y - a.y));
}

export function calibratedLinearFeet(raw: number, calibration: CalibrationSnapshot) {
  return raw * normalizedFeetPerDrawingUnit(calibration);
}

export function calibratedSquareFeet(rawArea: number, calibration: CalibrationSnapshot) {
  const scale = normalizedFeetPerDrawingUnit(calibration);
  return rawArea * scale * scale;
}
