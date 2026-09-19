import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FormattedMessage } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import {
  useFindGalleries,
  useFindGroups,
  useFindImages,
  useFindPerformers,
  useFindSceneMarkers,
  useFindScenes,
  useFindStudios,
  useFindTags,
} from "src/core/StashService";
import { ListFilterModel } from "src/models/list-filter/filter";
import { SceneQueue } from "src/models/sceneQueue";
import { ImageCard } from "src/components/Images/ImageCard";
import { SceneCardGrid } from "src/components/Scenes/SceneCardGrid";
import { GalleryCardGrid } from "src/components/Galleries/GalleryCardGrid";
import { PerformerCardGrid } from "src/components/Performers/PerformerCardGrid";
import { StudioCardGrid } from "src/components/Studios/StudioCardGrid";
import { TagCardGrid } from "src/components/Tags/TagCardGrid";
import { GroupCardGrid } from "src/components/Groups/GroupCardGrid";
import { SceneMarkerCardGrid } from "src/components/Scenes/SceneMarkerCardGrid";
import {
  useCardWidth,
  useContainerDimensions,
} from "src/components/Shared/GridCard/GridCard";
import { RecommendationRow } from "../RecommendationRow";
import {
  computeDenseLayout,
  DENSE_ZOOM_WIDTHS,
  frontPageViewAllPath,
  IDenseLayout,
} from "./denseLayout";
import { IDenseViewport } from "./useDenseViewport";

const emptySelectedIds = new Set<string>();
const noopSelect = () => {};

function useQueryFilter(filter: ListFilterModel, itemsPerPage: number) {
  return useMemo(() => {
    const ret = filter.clone();
    ret.itemsPerPage = itemsPerPage;
    ret.currentPage = 1;
    return ret;
  }, [filter, itemsPerPage]);
}

function pickQueryData<T>(result: {
  data?: T | null;
  previousData?: T | null;
  loading: boolean;
}): { data: T | undefined; showSkeleton: boolean } {
  const data = result.data ?? result.previousData ?? undefined;
  return {
    data,
    showSkeleton: result.loading && data === undefined,
  };
}

function useStableDenseLayout(layout: IDenseLayout): IDenseLayout {
  const [stable, setStable] = useState(layout);

  useEffect(() => {
    if (
      stable.itemsPerPage === layout.itemsPerPage &&
      stable.zoomIndex === layout.zoomIndex
    ) {
      return;
    }

    const handle = window.setTimeout(() => setStable(layout), 250);
    return () => window.clearTimeout(handle);
  }, [layout, stable.itemsPerPage, stable.zoomIndex]);

  return stable;
}

interface ISectionShell {
  className: string;
  header: string;
  mode: GQL.FilterMode;
  filter: ListFilterModel;
  count: number;
  loading: boolean;
}

const SectionShell: React.FC<React.PropsWithChildren<ISectionShell>> = ({
  className,
  header,
  mode,
  filter,
  count,
  loading,
  children,
}) => {
  if (!loading && !count) {
    return null;
  }

  return (
    <RecommendationRow
      className={`frontpage-dense-section ${className}`}
      header={header}
      link={
        <Link to={frontPageViewAllPath(mode, filter.makeQueryParameters())}>
          <FormattedMessage id="view_all" />
        </Link>
      }
    >
      {loading ? <div className="frontpage-dense-skeleton" /> : children}
    </RecommendationRow>
  );
};

interface IGridProps {
  filter: ListFilterModel;
  header: string;
  zoomIndex: number;
  itemsPerPage: number;
}

const DenseImageGrid: React.FC<{
  images: GQL.SlimImageDataFragment[];
  zoomIndex: number;
}> = ({ images, zoomIndex }) => {
  const [componentRef, { width: containerWidth }] = useContainerDimensions();
  const cardWidth = useCardWidth(
    containerWidth,
    zoomIndex,
    Array.from(DENSE_ZOOM_WIDTHS)
  );

  return (
    <div className="row justify-content-center" ref={componentRef}>
      {images.map((image) => (
        <ImageCard
          key={image.id}
          cardWidth={cardWidth}
          image={image}
          zoomIndex={zoomIndex}
        />
      ))}
    </div>
  );
};

const DenseScenes: React.FC<IGridProps> = ({
  filter,
  header,
  zoomIndex,
  itemsPerPage,
}) => {
  const queryFilter = useQueryFilter(filter, itemsPerPage);
  const result = useFindScenes(queryFilter);
  const { data, showSkeleton } = pickQueryData(result);
  const queue = useMemo(
    () => SceneQueue.fromListFilterModel(queryFilter),
    [queryFilter]
  );
  const scenes = data?.findScenes.scenes ?? [];

  return (
    <SectionShell
      className="scene-recommendations"
      header={header}
      mode={GQL.FilterMode.Scenes}
      filter={filter}
      count={data?.findScenes.count ?? 0}
      loading={showSkeleton}
    >
      <SceneCardGrid
        scenes={scenes}
        queue={queue}
        selectedIds={emptySelectedIds}
        zoomIndex={zoomIndex}
        onSelectChange={noopSelect}
      />
    </SectionShell>
  );
};

const DenseImages: React.FC<IGridProps> = ({
  filter,
  header,
  zoomIndex,
  itemsPerPage,
}) => {
  const queryFilter = useQueryFilter(filter, itemsPerPage);
  const result = useFindImages(queryFilter);
  const { data, showSkeleton } = pickQueryData(result);
  const images = data?.findImages.images ?? [];

  return (
    <SectionShell
      className="images-recommendations"
      header={header}
      mode={GQL.FilterMode.Images}
      filter={filter}
      count={data?.findImages.count ?? 0}
      loading={showSkeleton}
    >
      <DenseImageGrid images={images} zoomIndex={zoomIndex} />
    </SectionShell>
  );
};

const DenseGalleries: React.FC<IGridProps> = ({
  filter,
  header,
  zoomIndex,
  itemsPerPage,
}) => {
  const queryFilter = useQueryFilter(filter, itemsPerPage);
  const result = useFindGalleries(queryFilter);
  const { data, showSkeleton } = pickQueryData(result);
  const galleries = data?.findGalleries.galleries ?? [];

  return (
    <SectionShell
      className="gallery-recommendations"
      header={header}
      mode={GQL.FilterMode.Galleries}
      filter={filter}
      count={data?.findGalleries.count ?? 0}
      loading={showSkeleton}
    >
      <GalleryCardGrid
        galleries={galleries}
        selectedIds={emptySelectedIds}
        zoomIndex={zoomIndex}
        onSelectChange={noopSelect}
      />
    </SectionShell>
  );
};

const DensePerformers: React.FC<IGridProps> = ({
  filter,
  header,
  zoomIndex,
  itemsPerPage,
}) => {
  const queryFilter = useQueryFilter(filter, itemsPerPage);
  const result = useFindPerformers(queryFilter);
  const { data, showSkeleton } = pickQueryData(result);
  const performers = data?.findPerformers.performers ?? [];

  return (
    <SectionShell
      className="performer-recommendations"
      header={header}
      mode={GQL.FilterMode.Performers}
      filter={filter}
      count={data?.findPerformers.count ?? 0}
      loading={showSkeleton}
    >
      <PerformerCardGrid
        performers={performers}
        selectedIds={emptySelectedIds}
        zoomIndex={zoomIndex}
        onSelectChange={noopSelect}
      />
    </SectionShell>
  );
};

const DenseStudios: React.FC<IGridProps> = ({
  filter,
  header,
  zoomIndex,
  itemsPerPage,
}) => {
  const queryFilter = useQueryFilter(filter, itemsPerPage);
  const result = useFindStudios(queryFilter);
  const { data, showSkeleton } = pickQueryData(result);
  const studios = data?.findStudios.studios ?? [];

  return (
    <SectionShell
      className="studio-recommendations"
      header={header}
      mode={GQL.FilterMode.Studios}
      filter={filter}
      count={data?.findStudios.count ?? 0}
      loading={showSkeleton}
    >
      <StudioCardGrid
        studios={studios}
        fromParent
        selectedIds={emptySelectedIds}
        zoomIndex={zoomIndex}
        onSelectChange={noopSelect}
      />
    </SectionShell>
  );
};

const DenseTags: React.FC<IGridProps> = ({
  filter,
  header,
  zoomIndex,
  itemsPerPage,
}) => {
  const queryFilter = useQueryFilter(filter, itemsPerPage);
  const result = useFindTags(queryFilter);
  const { data, showSkeleton } = pickQueryData(result);
  const tags = data?.findTags.tags ?? [];

  return (
    <SectionShell
      className="tag-recommendations"
      header={header}
      mode={GQL.FilterMode.Tags}
      filter={filter}
      count={data?.findTags.count ?? 0}
      loading={showSkeleton}
    >
      <TagCardGrid
        tags={tags}
        selectedIds={emptySelectedIds}
        zoomIndex={zoomIndex}
        onSelectChange={noopSelect}
      />
    </SectionShell>
  );
};

const DenseGroups: React.FC<IGridProps> = ({
  filter,
  header,
  zoomIndex,
  itemsPerPage,
}) => {
  const queryFilter = useQueryFilter(filter, itemsPerPage);
  const result = useFindGroups(queryFilter);
  const { data, showSkeleton } = pickQueryData(result);
  const groups = data?.findGroups.groups ?? [];

  return (
    <SectionShell
      className="group-recommendations"
      header={header}
      mode={GQL.FilterMode.Groups}
      filter={filter}
      count={data?.findGroups.count ?? 0}
      loading={showSkeleton}
    >
      <GroupCardGrid
        groups={groups}
        selectedIds={emptySelectedIds}
        zoomIndex={zoomIndex}
        onSelectChange={noopSelect}
      />
    </SectionShell>
  );
};

const DenseMarkers: React.FC<IGridProps> = ({
  filter,
  header,
  zoomIndex,
  itemsPerPage,
}) => {
  const queryFilter = useQueryFilter(filter, itemsPerPage);
  const result = useFindSceneMarkers(queryFilter);
  const { data, showSkeleton } = pickQueryData(result);
  const markers = data?.findSceneMarkers.scene_markers ?? [];

  return (
    <SectionShell
      className="scene-marker-recommendations"
      header={header}
      mode={GQL.FilterMode.SceneMarkers}
      filter={filter}
      count={data?.findSceneMarkers.count ?? 0}
      loading={showSkeleton}
    >
      <SceneMarkerCardGrid
        markers={markers}
        selectedIds={emptySelectedIds}
        zoomIndex={zoomIndex}
        onSelectChange={noopSelect}
      />
    </SectionShell>
  );
};

interface IDenseFilterSection {
  mode: GQL.FilterMode;
  filter: ListFilterModel;
  header: string;
  viewport: IDenseViewport;
  extraRow: boolean;
}

export const DenseFilterSection: React.FC<IDenseFilterSection> = ({
  mode,
  filter,
  header,
  viewport,
  extraRow,
}) => {
  const layout = useMemo(
    () => computeDenseLayout(viewport.width, viewport.height, mode, extraRow),
    [viewport.width, viewport.height, extraRow, mode]
  );
  const stableLayout = useStableDenseLayout(layout);

  const gridProps: IGridProps = {
    filter,
    header,
    zoomIndex: stableLayout.zoomIndex,
    itemsPerPage: stableLayout.itemsPerPage,
  };

  switch (mode) {
    case GQL.FilterMode.Scenes:
      return <DenseScenes {...gridProps} />;
    case GQL.FilterMode.Images:
      return <DenseImages {...gridProps} />;
    case GQL.FilterMode.Galleries:
      return <DenseGalleries {...gridProps} />;
    case GQL.FilterMode.Performers:
      return <DensePerformers {...gridProps} />;
    case GQL.FilterMode.Studios:
      return <DenseStudios {...gridProps} />;
    case GQL.FilterMode.Tags:
      return <DenseTags {...gridProps} />;
    case GQL.FilterMode.Movies:
    case GQL.FilterMode.Groups:
      return <DenseGroups {...gridProps} />;
    case GQL.FilterMode.SceneMarkers:
      return <DenseMarkers {...gridProps} />;
    default:
      return null;
  }
};
