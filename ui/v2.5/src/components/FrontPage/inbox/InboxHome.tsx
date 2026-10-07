// Inbox home: mixed "inbox" Scene/Image wall with an all/scenes/images switch,
// refresh, load more, per-category view-all and independent per-category
// loading/empty/error states, plus a directly-opening image lightbox.
import React, { useCallback, useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import { IntlShape, useIntl } from "react-intl";
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import { IInboxCategory, useInboxFilters } from "./inboxFilters";
import { InboxWall } from "./InboxWall";
import { useInboxImages, useInboxScenes } from "./useInboxCategory";
import { useInboxLightbox } from "./useInboxLightbox";
import { useScrollRestoration } from "src/hooks/scrollToTop";
import { InboxTab, readInboxTab, writeInboxTab } from "./inboxSession";

function inboxListPath(mode: GQL.FilterMode): string {
  return mode === GQL.FilterMode.Scenes ? "/scenes" : "/images";
}

function categoryLabel(intl: IntlShape, mode: GQL.FilterMode): string {
  return mode === GQL.FilterMode.Scenes
    ? intl.formatMessage({ id: "scenes", defaultMessage: "Scenes" })
    : intl.formatMessage({ id: "images", defaultMessage: "Images" });
}

// Identity of the filter a category's range belongs to. A status, condition or
// refresh change produces a new key, clearing the previous media.
function categoryKey(category: IInboxCategory, refreshEpoch: number): string {
  return `${category.status}|${category.signature}|${refreshEpoch}`;
}

interface INoticeProps {
  category: IInboxCategory;
  onRetry?: () => void;
}

const CategoryNotice: React.FC<INoticeProps> = ({ category, onRetry }) => {
  const intl = useIntl();
  const label = categoryLabel(intl, category.mode);
  const listPath = inboxListPath(category.mode);

  switch (category.status) {
    case "loading":
    case "ok":
      return null;
    case "missing":
      return (
        <div className="inbox-notice">
          <span>
            {intl.formatMessage(
              {
                id: "inbox.missing",
                defaultMessage: "No saved filter named “inbox” in {category}.",
              },
              { category: label }
            )}
          </span>{" "}
          <Link to={listPath}>
            {intl.formatMessage(
              {
                id: "inbox.missing.link",
                defaultMessage: "Create one in {category}",
              },
              { category: label }
            )}
          </Link>
        </div>
      );
    case "ambiguous":
      return (
        <div className="inbox-notice">
          {intl.formatMessage(
            {
              id: "inbox.ambiguous",
              defaultMessage:
                "Multiple saved filters named “inbox” in {category}: {names}.",
            },
            { category: label, names: category.matches.join(", ") }
          )}
        </div>
      );
    case "unsupported":
      return (
        <div className="inbox-notice">
          {intl.formatMessage(
            {
              id: "inbox.unsupported",
              defaultMessage:
                "The {category} inbox filter uses unsupported conditions and cannot be queried.",
            },
            { category: label }
          )}
        </div>
      );
    case "error":
      return (
        <div className="inbox-notice">
          <span>
            {intl.formatMessage(
              {
                id: "inbox.filters_error",
                defaultMessage: "Could not load the {category} inbox filter.",
              },
              { category: label }
            )}
          </span>
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {intl.formatMessage({
                id: "actions.retry",
                defaultMessage: "Retry",
              })}
            </Button>
          ) : null}
        </div>
      );
    default:
      return null;
  }
};

interface ICategoryState {
  loading: boolean;
  error?: Error;
  loaded: number;
}

const InboxHome: React.FC = () => {
  const intl = useIntl();

  const filters = useInboxFilters();
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const scenesOk = filters.scenes.status === "ok";
  const imagesOk = filters.images.status === "ok";

  const scenesKey = categoryKey(filters.scenes, refreshEpoch);
  const imagesKey = categoryKey(filters.images, refreshEpoch);

  const scenes = useInboxScenes(
    filters.scenes.queryFilter,
    scenesOk,
    scenesKey
  );
  const images = useInboxImages(
    filters.images.queryFilter,
    imagesOk,
    imagesKey
  );

  const lightbox = useInboxLightbox(
    filters.images.queryFilter,
    images.count,
    imagesOk,
    imagesKey
  );

  const [tab, setTab] = useState<InboxTab>(() => readInboxTab());

  const selectTab = useCallback((next: InboxTab) => {
    setTab(next);
    writeInboxTab(next);
  }, []);

  const onRefresh = useCallback(async () => {
    window.scrollTo(0, 0);
    // Re-read the saved filters first so the previous range is never refetched.
    await filters.refetch();
    setRefreshEpoch((epoch) => epoch + 1);
  }, [filters]);

  const onLoadMore = useCallback(() => {
    if (tab !== "images" && scenes.canLoadMore) scenes.loadMore();
    if (tab !== "scenes" && images.canLoadMore) images.loadMore();
  }, [tab, scenes, images]);

  const scenesShown = tab !== "images";
  const imagesShown = tab !== "scenes";
  const displayedScenes = scenesShown ? scenes.items : [];
  const displayedImages = imagesShown ? images.items : [];
  const shownCategories = useMemo(
    () => [
      ...(scenesShown ? [filters.scenes] : []),
      ...(imagesShown ? [filters.images] : []),
    ],
    [scenesShown, imagesShown, filters.scenes, filters.images]
  );

  const stateFor = (category: IInboxCategory): ICategoryState =>
    category.mode === GQL.FilterMode.Scenes
      ? {
          loading: scenes.loading,
          error: scenes.error,
          loaded: scenes.items.length,
        }
      : {
          loading: images.loading,
          error: images.error,
          loaded: images.items.length,
        };

  const shownCount =
    (scenesShown ? scenes.items.length : 0) +
    (imagesShown ? images.items.length : 0);
  const anyLoading =
    shownCategories.some((c) => c.status === "loading") ||
    (scenesShown && scenesOk && scenes.loading) ||
    (imagesShown && imagesOk && images.loading);
  useScrollRestoration(anyLoading);

  const anyFetching =
    (scenesShown && scenesOk && scenes.fetching) ||
    (imagesShown && imagesOk && images.fetching);
  const showLoadMore =
    (scenesShown && scenesOk && scenes.hasMore) ||
    (imagesShown && imagesOk && images.hasMore);
  const canLoadMore =
    (scenesShown && scenesOk && scenes.canLoadMore) ||
    (imagesShown && imagesOk && images.canLoadMore);
  const dataErrors = [
    ...(scenesShown && scenesOk && scenes.error
      ? [{ key: "scenes", retry: scenes.retry }]
      : []),
    ...(imagesShown && imagesOk && images.error
      ? [{ key: "images", retry: images.retry }]
      : []),
  ];
  // Empty only when the query succeeded and returned nothing; a failed first
  // batch is an error, not an empty Inbox.
  const emptyCategories = shownCategories.filter((category) => {
    if (category.status !== "ok") return false;
    const state = stateFor(category);
    return !state.loading && !state.error && state.loaded === 0;
  });

  return (
    <div className="inbox-home">
      <header className="inbox-toolbar">
        <h1 className="inbox-title">
          {intl.formatMessage({ id: "inbox.title", defaultMessage: "Inbox" })}
        </h1>
        <div className="inbox-tabs" role="tablist">
          {(
            [
              ["all", intl.formatMessage({ id: "all", defaultMessage: "All" })],
              ["scenes", categoryLabel(intl, GQL.FilterMode.Scenes)],
              ["images", categoryLabel(intl, GQL.FilterMode.Images)],
            ] as [InboxTab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? "inbox-tab active" : "inbox-tab"}
              onClick={() => selectTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="inbox-toolbar-actions">
          {shownCategories.map(
            (category) =>
              category.viewAllPath && (
                <Link
                  key={category.mode}
                  className="inbox-view-all"
                  to={category.viewAllPath}
                >
                  {intl.formatMessage(
                    {
                      id: "inbox.view_all",
                      defaultMessage: "View all {category}",
                    },
                    { category: categoryLabel(intl, category.mode) }
                  )}
                </Link>
              )
          )}
          <Button
            variant="secondary"
            size="sm"
            className="inbox-refresh"
            onClick={onRefresh}
            disabled={anyFetching}
          >
            {intl.formatMessage({
              id: "inbox.refresh",
              defaultMessage: "Refresh",
            })}
          </Button>
        </div>
      </header>

      {shownCategories.map((category) => (
        <CategoryNotice
          key={category.mode}
          category={category}
          onRetry={category.status === "error" ? filters.refetch : undefined}
        />
      ))}

      {emptyCategories.map((category) => (
        <div key={`empty-${category.mode}`} className="inbox-notice">
          {intl.formatMessage(
            {
              id: "inbox.category_empty",
              defaultMessage: "The {category} inbox filter matches no media.",
            },
            { category: categoryLabel(intl, category.mode) }
          )}
        </div>
      ))}

      {dataErrors.map((entry) => (
        <div key={entry.key} className="inbox-notice">
          <span>
            {intl.formatMessage({
              id: "inbox.load_error",
              defaultMessage: "Could not load inbox content.",
            })}
          </span>
          <Button variant="secondary" size="sm" onClick={entry.retry}>
            {intl.formatMessage({
              id: "actions.retry",
              defaultMessage: "Retry",
            })}
          </Button>
        </div>
      ))}

      {anyLoading && shownCount === 0 ? (
        <div className="inbox-skeleton" aria-hidden="true" />
      ) : (
        <InboxWall
          scenes={displayedScenes}
          images={displayedImages}
          onImageOpen={lightbox.openAt}
          showVideoBadge={tab === "all"}
        />
      )}

      {showLoadMore && (
        <div className="inbox-footer">
          <Button
            variant="secondary"
            onClick={onLoadMore}
            disabled={!canLoadMore}
          >
            {intl.formatMessage({
              id: "inbox.load_more",
              defaultMessage: "Load more",
            })}
          </Button>
        </div>
      )}
    </div>
  );
};

export default InboxHome;
