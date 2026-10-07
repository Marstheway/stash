// Glue between the shared list-filter model and the Inbox home: resolves the
// "inbox" saved filter per category and builds the range/lightbox filters, the
// filter signature and the view-all URL.
import { useMemo } from "react";
import * as GQL from "src/core/generated-graphql";
import { useFindSavedFilters } from "src/core/StashService";
import { useConfigurationContext } from "src/hooks/Config";
import { ListFilterModel } from "src/models/list-filter/filter";
import { UnsupportedCriterion } from "src/models/list-filter/criteria/criterion";
import { frontPageViewAllPath } from "../dense/denseLayout";
import {
  INBOX_PAGE_SIZE,
  resolveInboxRandomSeed,
  resolveInboxSavedFilter,
} from "./inboxModel";
import { inboxSeed } from "./inboxSession";

export type InboxCategoryStatus =
  | "loading"
  | "missing"
  | "ambiguous"
  | "unsupported"
  | "error"
  | "ok";

export interface IInboxCategory {
  mode: GQL.FilterMode;
  status: InboxCategoryStatus;
  savedFilter?: GQL.SavedFilterDataFragment;
  // Stored names of the matching filters, used to describe ambiguity.
  matches: string[];
  // Home range filter: saved conditions with the home page size applied.
  queryFilter?: ListFilterModel;
  // Existing list URL carrying the saved conditions, when queryable.
  viewAllPath?: string;
  // Effective conditions/sort of this category. A change here (e.g. an edited
  // saved filter with the same id) must clear the range and close the lightbox.
  signature: string;
}

export interface IInboxFilters {
  loading: boolean;
  error?: Error;
  scenes: IInboxCategory;
  images: IInboxCategory;
  // Resolves once the saved filters have been re-read. allSettled so one
  // category failing does not reject the refresh.
  refetch: () => Promise<void>;
}

function baseFilter(
  mode: GQL.FilterMode,
  saved: GQL.SavedFilterDataFragment,
  config: GQL.ConfigDataFragment | undefined
): ListFilterModel {
  const filter = new ListFilterModel(mode, config);
  filter.currentPage = 1;
  filter.configureFromSavedFilter(saved);
  filter.currentPage = 1;
  // The saved filter is never modified; the session seed keeps random paging
  // stable across the browse.
  filter.randomSeed = resolveInboxRandomSeed(
    filter.sortBy,
    filter.randomSeed,
    inboxSeed(mode)
  );
  return filter;
}

function buildCategory(
  mode: GQL.FilterMode,
  filters: GQL.SavedFilterDataFragment[] | undefined,
  loading: boolean,
  error: Error | undefined,
  config: GQL.ConfigDataFragment | undefined
): IInboxCategory {
  if (loading)
    return { mode, status: "loading", matches: [], signature: "loading" };
  if (error) return { mode, status: "error", matches: [], signature: "error" };

  const resolution = resolveInboxSavedFilter(filters ?? [], mode);
  if (resolution.status === "missing") {
    return { mode, status: "missing", matches: [], signature: "missing" };
  }
  if (resolution.status === "ambiguous") {
    return {
      mode,
      status: "ambiguous",
      matches: resolution.matches,
      signature: `ambiguous:${resolution.matches.join("|")}`,
    };
  }

  const saved = resolution.filter as GQL.SavedFilterDataFragment;
  const range = baseFilter(mode, saved, config);
  range.itemsPerPage = INBOX_PAGE_SIZE;
  const signature = `ok:${range.makeQueryParameters()}`;

  if (range.criteria.some((c) => c instanceof UnsupportedCriterion)) {
    // An unsupported condition would silently drop from the request.
    return {
      mode,
      status: "unsupported",
      matches: resolution.matches,
      signature: `unsupported:${signature}`,
    };
  }

  const viewAll = baseFilter(mode, saved, config);
  const viewAllPath = frontPageViewAllPath(mode, viewAll.makeQueryParameters());

  return {
    mode,
    status: "ok",
    savedFilter: saved,
    matches: resolution.matches,
    queryFilter: range,
    viewAllPath,
    signature,
  };
}

export function useInboxFilters(): IInboxFilters {
  const { configuration } = useConfigurationContext();
  const config = configuration;

  const scenesResult = useFindSavedFilters(GQL.FilterMode.Scenes);
  const imagesResult = useFindSavedFilters(GQL.FilterMode.Images);

  const scenes = useMemo(
    () =>
      buildCategory(
        GQL.FilterMode.Scenes,
        scenesResult.data?.findSavedFilters,
        scenesResult.loading,
        scenesResult.error,
        config
      ),
    [
      scenesResult.data?.findSavedFilters,
      scenesResult.loading,
      scenesResult.error,
      config,
    ]
  );

  const images = useMemo(
    () =>
      buildCategory(
        GQL.FilterMode.Images,
        imagesResult.data?.findSavedFilters,
        imagesResult.loading,
        imagesResult.error,
        config
      ),
    [
      imagesResult.data?.findSavedFilters,
      imagesResult.loading,
      imagesResult.error,
      config,
    ]
  );

  const refetch = async () => {
    await Promise.allSettled([scenesResult.refetch(), imagesResult.refetch()]);
  };

  return {
    loading: scenesResult.loading || imagesResult.loading,
    error: scenesResult.error ?? imagesResult.error,
    scenes,
    images,
    refetch,
  };
}

export function buildInboxRangeFilter(
  base: ListFilterModel,
  pages: number
): ListFilterModel {
  const filter = base.clone();
  filter.currentPage = 1;
  filter.itemsPerPage = pages * INBOX_PAGE_SIZE;
  return filter;
}

export function buildInboxPageFilter(
  base: ListFilterModel,
  page: number
): ListFilterModel {
  const filter = base.clone();
  filter.currentPage = page;
  filter.itemsPerPage = INBOX_PAGE_SIZE;
  return filter;
}
