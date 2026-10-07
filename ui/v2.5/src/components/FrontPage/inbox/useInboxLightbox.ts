// Image lightbox integration for the Inbox home: an independent 24-image
// pagination via an active cache-and-network query, with precise global
// position, stale-request isolation and close-on-filter-change.
import { NetworkStatus } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as GQL from "src/core/generated-graphql";
import { useToast } from "src/hooks/Toast";
import { useLightboxContext } from "src/hooks/Lightbox/context";
import { ListFilterModel } from "src/models/list-filter/filter";
import { buildInboxPageFilter } from "./inboxFilters";
import {
  computeInboxLightboxPage,
  dedupeInbox,
  inboxPageOffset,
  inboxTotalPages,
  INBOX_PAGE_SIZE,
  shouldCloseInboxLightboxForChange,
  shouldDeliverInboxLightbox,
  wrapInboxPage,
} from "./inboxModel";

export interface IInboxLightbox {
  // Opens the lightbox on the image at its index in the loaded image Inbox.
  openAt: (globalIndex: number) => void;
}

export function useInboxLightbox(
  imageFilter: ListFilterModel | undefined,
  totalCount: number,
  enabled: boolean,
  filterKey: string
): IInboxLightbox {
  const { setLightboxState, hideLightbox } = useLightboxContext();
  const Toast = useToast();
  // Toast identity changes when a toast renders; keep it out of effect deps.
  const toastRef = useRef(Toast);
  toastRef.current = Toast;

  const [requestedPage, setRequestedPage] = useState<number | undefined>();
  // Bumped on every open so a cached batch is re-delivered even when the page
  // number is unchanged.
  const [requestNonce, setRequestNonce] = useState(0);
  const activeRef = useRef(false);
  const displayPageRef = useRef(1);
  // Page of the newest issued request; results are only accepted for it.
  const requestRef = useRef<number | undefined>();
  // Result object already delivered and page/ids of the last delivered batch.
  // The latter survive a close so a rapid reopen cannot accept the old batch.
  const lastDeliveredDataRef = useRef<unknown>(undefined);
  const deliveredPageRef = useRef(0);
  const deliveredIdsRef = useRef<string[]>([]);
  const batchRef = useRef<GQL.SlimImageDataFragment[]>([]);
  const batchIdsRef = useRef<string[]>([]);
  const failedPageRef = useRef<number | undefined>();
  const countRef = useRef(totalCount);
  countRef.current = totalCount;

  const pageFilter = useMemo(
    () =>
      enabled && imageFilter && requestedPage !== undefined
        ? buildInboxPageFilter(imageFilter, requestedPage)
        : undefined,
    [enabled, imageFilter, requestedPage]
  );

  const result = GQL.useFindImagesQuery({
    skip: !pageFilter,
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
    variables: {
      filter: pageFilter?.makeFindFilter(),
      image_filter: pageFilter?.makeFilter(),
    },
  });

  const { data: resultData, networkStatus, error: resultError } = result;

  const close = useCallback(() => {
    activeRef.current = false;
    requestRef.current = undefined;
    lastDeliveredDataRef.current = undefined;
    setRequestedPage(undefined);
    batchRef.current = [];
    batchIdsRef.current = [];
    failedPageRef.current = undefined;
    // Do not leak the batch offset to a later lightbox entry.
    setLightboxState({ indexOffset: 0 });
  }, [setLightboxState]);

  // Release the shared lightbox's page-switch guard without a page change: it
  // waits for the images array identity to change.
  const releaseWithoutSwitch = useCallback(() => {
    setLightboxState({
      images: [...batchRef.current],
      isLoading: false,
      totalCount: countRef.current,
    });
  }, [setLightboxState]);

  const handlePage = useCallback(
    ({ direction, page }: { direction?: number; page?: number }) => {
      if (!activeRef.current) return;

      const totalPages =
        inboxTotalPages(countRef.current, INBOX_PAGE_SIZE) || 1;
      let target = displayPageRef.current;
      if (direction !== undefined) {
        target = displayPageRef.current + (direction < 0 ? -1 : 1);
      } else if (page !== undefined) {
        target = page;
      }
      target = wrapInboxPage(target, totalPages);

      failedPageRef.current = undefined;

      if (target === displayPageRef.current && batchRef.current.length > 0) {
        releaseWithoutSwitch();
        return;
      }

      requestRef.current = target;
      setLightboxState({ isLoading: true });
      setRequestNonce((n) => n + 1);
      setRequestedPage(target);
    },
    [setLightboxState, releaseWithoutSwitch]
  );

  const openAt = useCallback(
    (globalIndex: number) => {
      if (!enabled || !imageFilter) return;

      const totalPages =
        inboxTotalPages(countRef.current, INBOX_PAGE_SIZE) || 1;
      const { page, initialIndex } = computeInboxLightboxPage(
        globalIndex,
        INBOX_PAGE_SIZE
      );
      const targetPage = wrapInboxPage(page, totalPages);

      failedPageRef.current = undefined;
      requestRef.current = targetPage;
      displayPageRef.current = targetPage;
      lastDeliveredDataRef.current = undefined;
      batchRef.current = [];
      batchIdsRef.current = [];
      activeRef.current = true;
      setRequestNonce((n) => n + 1);
      setRequestedPage(targetPage);

      setLightboxState({
        images: [],
        isLoading: true,
        isVisible: true,
        initialIndex,
        showNavigation: false,
        pageCallback: handlePage,
        page: undefined,
        pages: undefined,
        pageSize: undefined,
        totalCount: countRef.current,
        // Global position: page is kept undefined to release the guard, so the
        // footer needs the batch offset.
        indexOffset: inboxPageOffset(targetPage, INBOX_PAGE_SIZE),
        // Forward must not reopen a closed Inbox batch.
        discardHistoryOnClose: true,
        chapters: [],
        slideshowEnabled: true,
        slideshowAutostart: false,
        onClose: close,
      });
    },
    [enabled, imageFilter, handlePage, close, setLightboxState]
  );

  // A refresh or filter change (including becoming unsupported) invalidates the
  // images on screen, so this entry's lightbox is closed.
  const previousFilterKey = useRef(filterKey);
  useEffect(() => {
    if (previousFilterKey.current === filterKey) return;
    previousFilterKey.current = filterKey;
    if (!activeRef.current) return;
    close();
    hideLightbox("navigate");
  }, [filterKey, close, hideLightbox]);

  useEffect(() => {
    if (!activeRef.current || requestedPage === undefined) return;
    if (networkStatus !== NetworkStatus.ready) return;

    const images = resultData?.findImages?.images;
    if (!images) return;

    const { current: requestPage } = requestRef;
    if (requestPage === undefined) return;

    const batch = dedupeInbox(images);
    const nextIds = batch.map((image) => image.id);

    if (
      !shouldDeliverInboxLightbox({
        deliveredPage: deliveredPageRef.current,
        requestPage,
        requestedPage,
        sameDataObject: resultData === lastDeliveredDataRef.current,
        deliveredIds: deliveredIdsRef.current,
        incomingIds: nextIds,
      })
    ) {
      return;
    }

    if (
      shouldCloseInboxLightboxForChange(
        displayPageRef.current,
        requestedPage,
        batchIdsRef.current,
        nextIds
      )
    ) {
      // The set changed under the displayed page: close rather than act on a
      // stale index.
      activeRef.current = false;
      toastRef.current.error("Inbox content changed");
      hideLightbox("navigate");
      return;
    }

    failedPageRef.current = undefined;
    lastDeliveredDataRef.current = resultData;
    deliveredPageRef.current = requestedPage;
    deliveredIdsRef.current = nextIds;
    batchRef.current = batch;
    batchIdsRef.current = nextIds;
    displayPageRef.current = requestedPage;
    setLightboxState({
      images: batch,
      isLoading: false,
      totalCount: resultData?.findImages?.count ?? countRef.current,
      indexOffset: inboxPageOffset(requestedPage, INBOX_PAGE_SIZE),
    });
  }, [
    networkStatus,
    resultData,
    requestedPage,
    requestNonce,
    hideLightbox,
    setLightboxState,
  ]);

  useEffect(() => {
    if (!activeRef.current || requestedPage === undefined) return;
    if (!resultError) return;
    if (failedPageRef.current === requestedPage) return;

    failedPageRef.current = requestedPage;
    toastRef.current.error(resultError);
    // Keep the current batch: a fresh copy releases the page-switch guard and
    // lands on its first (Next) or last (Prev) image; reverting the request
    // lets Next/Prev retry the same target.
    requestRef.current = displayPageRef.current;
    setLightboxState({
      images: [...batchRef.current],
      isLoading: false,
      totalCount: countRef.current,
    });
    setRequestedPage(displayPageRef.current);
    // Mark the reverted page as handled so the same error does not re-trigger.
    failedPageRef.current = displayPageRef.current;
  }, [resultError, requestedPage, setLightboxState]);

  useEffect(
    () => () => {
      if (activeRef.current) {
        activeRef.current = false;
        hideLightbox("navigate");
      }
    },
    [hideLightbox]
  );

  return { openAt };
}
