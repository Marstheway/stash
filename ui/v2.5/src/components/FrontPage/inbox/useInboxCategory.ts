// Data logic for one Inbox category: one active cache-and-network query that
// grows by a page (24) per load more. Range and error are local state keyed by
// the filter identity, so a filter/refresh change clears them.
import { NetworkStatus } from "@apollo/client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as GQL from "src/core/generated-graphql";
import { ListFilterModel } from "src/models/list-filter/filter";
import { applyInboxRange, IInboxIdentifiable, IInboxRange } from "./inboxModel";
import { buildInboxRangeFilter } from "./inboxFilters";
import { readInboxPages, writeInboxPages } from "./inboxSession";

export interface IInboxCategoryData<T> {
  items: T[];
  count: number;
  // Initial load only, before any range is available.
  loading: boolean;
  // Any in-flight network request for this category.
  fetching: boolean;
  error?: Error;
  hasMore: boolean;
  canLoadMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

const FETCHING_STATUSES: number[] = [
  NetworkStatus.loading,
  NetworkStatus.setVariables,
  NetworkStatus.fetchMore,
  NetworkStatus.refetch,
  NetworkStatus.poll,
];

interface IInboxQueryResult<T> {
  incoming: readonly T[] | undefined;
  count: number;
  networkStatus: number;
  error?: Error;
  refetch: () => void;
}

function useInboxRange<T extends IInboxIdentifiable>(
  rangeKey: string,
  enabled: boolean,
  pages: number,
  setPages: (pages: number) => void,
  query: IInboxQueryResult<T>
): IInboxCategoryData<T> {
  const key = `${enabled ? "1" : "0"}|${rangeKey}`;
  const [range, setRange] = useState<IInboxRange<T>>(() => ({
    key,
    items: [],
    count: 0,
  }));
  const [rangeError, setRangeError] = useState<Error | undefined>(undefined);

  const {
    incoming,
    count: incomingCount,
    networkStatus,
    error,
    refetch,
  } = query;

  if (range.key !== key) {
    // Different filter, refresh or no longer queryable: drop the previous
    // media and error before the new request resolves.
    setRange({ key, items: [], count: 0 });
    setRangeError(undefined);
  }

  useEffect(() => {
    // previousData is not used: it may belong to the previous filter/range.
    if (!enabled) return;
    if (incoming === undefined) {
      setRange((previous) => applyInboxRange(previous, key, undefined));
      return;
    }
    if (networkStatus !== NetworkStatus.ready || error) return;
    setRange((previous) =>
      applyInboxRange(previous, key, {
        items: incoming,
        count: incomingCount,
      })
    );
  }, [enabled, key, incoming, incomingCount, networkStatus, error]);

  useEffect(() => {
    // The error belongs to the current request only: an in-flight or successful
    // request clears it, an error status sets it.
    if (enabled && networkStatus === NetworkStatus.error) {
      setRangeError(error ?? new Error("Inbox request failed"));
    } else {
      setRangeError(undefined);
    }
  }, [enabled, key, networkStatus, error]);

  // A key change is a new filter or an explicit refresh: revalidate the first
  // batch without refetching the previous range.
  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;
    if (!enabled) return;
    if (pages === 1) {
      refetch();
    } else {
      setPages(1);
    }
  }, [key, enabled, pages, refetch, setPages]);

  const fetching = FETCHING_STATUSES.includes(networkStatus);
  const hasMore = range.items.length < range.count;
  const usableIncoming =
    incoming !== undefined && networkStatus === NetworkStatus.ready;

  return {
    items: range.items,
    count: range.count,
    loading:
      enabled && range.items.length === 0 && !usableIncoming && !rangeError,
    fetching,
    error: rangeError,
    hasMore,
    canLoadMore: enabled && !fetching && !rangeError && hasMore,
    loadMore: () => setPages(pages + 1),
    retry: refetch,
  };
}

export function useInboxScenes(
  baseFilter: ListFilterModel | undefined,
  enabled: boolean,
  rangeKey: string
): IInboxCategoryData<GQL.SlimSceneDataFragment> {
  const [pages, setPages] = useState(() =>
    readInboxPages(GQL.FilterMode.Scenes)
  );

  useEffect(() => {
    writeInboxPages(GQL.FilterMode.Scenes, pages);
  }, [pages]);

  const queryFilter = useMemo(
    () =>
      baseFilter && enabled
        ? buildInboxRangeFilter(baseFilter, pages)
        : undefined,
    [baseFilter, enabled, pages]
  );

  const result = GQL.useFindScenesQuery({
    skip: !queryFilter,
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
    variables: {
      filter: queryFilter?.makeFindFilter(),
      scene_filter: queryFilter?.makeFilter(),
    },
  });

  return useInboxRange(rangeKey, enabled, pages, setPages, {
    incoming: result.data?.findScenes?.scenes,
    count: result.data?.findScenes?.count ?? 0,
    networkStatus: result.networkStatus,
    error: result.error,
    refetch: () => result.refetch(),
  });
}

export function useInboxImages(
  baseFilter: ListFilterModel | undefined,
  enabled: boolean,
  rangeKey: string
): IInboxCategoryData<GQL.SlimImageDataFragment> {
  const [pages, setPages] = useState(() =>
    readInboxPages(GQL.FilterMode.Images)
  );

  useEffect(() => {
    writeInboxPages(GQL.FilterMode.Images, pages);
  }, [pages]);

  const queryFilter = useMemo(
    () =>
      baseFilter && enabled
        ? buildInboxRangeFilter(baseFilter, pages)
        : undefined,
    [baseFilter, enabled, pages]
  );

  const result = GQL.useFindImagesQuery({
    skip: !queryFilter,
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
    variables: {
      filter: queryFilter?.makeFindFilter(),
      image_filter: queryFilter?.makeFilter(),
    },
  });

  return useInboxRange(rangeKey, enabled, pages, setPages, {
    incoming: result.data?.findImages?.images,
    count: result.data?.findImages?.count ?? 0,
    networkStatus: result.networkStatus,
    error: result.error,
    refetch: () => result.refetch(),
  });
}
