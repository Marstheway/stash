import { FilterMode } from "src/core/generated-graphql";

export const DENSE_ZOOM_WIDTHS = [280, 340, 480, 640] as const;

const HEADER_RESERVE = 56;
const CONTAINER_PADDING = 30;
const CARD_MARGIN = 10;
const MAX_ITEMS = 80;
const MIN_ITEMS = 6;

export interface IDenseLayout {
  zoomIndex: number;
  preferredWidth: number;
  columns: number;
  rows: number;
  itemsPerPage: number;
}

export function pickZoomIndex(containerWidth: number): number {
  if (containerWidth >= 2800) return 3;
  if (containerWidth >= 1600) return 2;
  if (containerWidth >= 900) return 1;
  return 0;
}

export function estimateCardHeight(
  cardWidth: number,
  mode: FilterMode
): number {
  if (
    mode === FilterMode.Performers ||
    mode === FilterMode.Groups ||
    mode === FilterMode.Movies
  ) {
    return Math.round(cardWidth * 1.55) + 72;
  }

  return Math.round((cardWidth * 9) / 16) + 118;
}

export function computeDenseLayout(
  containerWidth: number,
  sectionHeight: number,
  mode: FilterMode,
  extraRow: boolean
): IDenseLayout {
  const width = Math.max(containerWidth, 320);
  const zoomIndex = pickZoomIndex(width);
  const preferredWidth = DENSE_ZOOM_WIDTHS[zoomIndex];
  const columns = Math.max(
    1,
    Math.ceil((width - CONTAINER_PADDING) / preferredWidth)
  );
  const cardWidth = (width - CONTAINER_PADDING) / columns - CARD_MARGIN;
  const cardHeight = estimateCardHeight(cardWidth, mode);
  const gridHeight = Math.max(sectionHeight - HEADER_RESERVE, cardHeight);
  let rows = Math.max(1, Math.floor(gridHeight / cardHeight));
  if (extraRow) {
    rows += 1;
  }

  const itemsPerPage = Math.min(
    MAX_ITEMS,
    Math.max(columns * rows, columns, MIN_ITEMS)
  );

  return {
    zoomIndex,
    preferredWidth,
    columns,
    rows,
    itemsPerPage,
  };
}

export function frontPageViewAllPath(mode: FilterMode, query: string): string {
  switch (mode) {
    case FilterMode.Scenes:
      return `/scenes?${query}`;
    case FilterMode.Images:
      return `/images?${query}`;
    case FilterMode.Galleries:
      return `/galleries?${query}`;
    case FilterMode.Performers:
      return `/performers?${query}`;
    case FilterMode.Studios:
      return `/studios?${query}`;
    case FilterMode.Tags:
      return `/tags?${query}`;
    case FilterMode.Movies:
    case FilterMode.Groups:
      return `/groups?${query}`;
    case FilterMode.SceneMarkers:
      return `/scenes/markers?${query}`;
    default:
      return `/?${query}`;
  }
}
