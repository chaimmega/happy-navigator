/** Shared display constants for routes — used by MapView and RoutePanel */

export const ROUTE_COLORS = ["hsl(155, 75%, 42%)", "hsl(210, 90%, 55%)", "hsl(25, 95%, 55%)"] as const;
export const ROUTE_NAMES = ["Route A", "Route B", "Route C"] as const;

/** @deprecated Use ROUTE_NAMES instead */
export const ROUTE_LABELS = ROUTE_NAMES;
