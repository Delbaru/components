export interface RoundedTreePathOptions {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius: number;
}

/**
 * Строит SVG-path «скруглённого» коннектора (вертикаль → дуга → горизонталь) от точки к точке.
 * Pure-геометрия для древо-/spine-коннекторов меню (FlowSpine, StepCardConnectorLayer).
 */
export function getRoundedTreePath({
  fromX,
  fromY,
  toX,
  toY,
  radius,
}: RoundedTreePathOptions): string {
  const verticalDirection = toY >= fromY ? 1 : -1;
  const horizontalDirection = toX >= fromX ? 1 : -1;
  const verticalDistance = Math.abs(toY - fromY);
  const horizontalDistance = Math.abs(toX - fromX);
  const safeRadius = Math.max(
    0,
    Math.min(radius, verticalDistance / 2, horizontalDistance)
  );

  if (safeRadius === 0) {
    return [
      `M ${fromX} ${fromY}`,
      `V ${toY}`,
      `H ${toX}`,
    ].join(' ');
  }

  return [
    `M ${fromX} ${fromY}`,
    `V ${toY - safeRadius * verticalDirection}`,
    `Q ${fromX} ${toY} ${fromX + safeRadius * horizontalDirection} ${toY}`,
    `H ${toX}`,
  ].join(' ');
}
