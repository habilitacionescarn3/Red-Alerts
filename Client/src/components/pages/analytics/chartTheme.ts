/** Shared recharts styling for the analytics cards (theme-aware CSS vars). */

// One margin + axis width across the cards (replaces per-card left:-16 hacks).
export const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 0 };
export const Y_AXIS_WIDTH = 32;

export const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};

// Recharts colors each tooltip row with the SERIES color, falling back to
// black when the series has none (e.g. a Bar colored via per-datum <Cell>s) -
// invisible on the dark popover. Force a readable text color everywhere.
export const TOOLTIP_ITEM_STYLE = {
  color: 'var(--popover-foreground)',
};

export const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
