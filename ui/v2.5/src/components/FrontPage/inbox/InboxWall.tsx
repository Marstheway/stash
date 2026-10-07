import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { Badge } from "react-bootstrap";
import { faVideo } from "@fortawesome/free-solid-svg-icons";
import { useIntl } from "react-intl";
import { Icon } from "src/components/Shared/Icon";
import Gallery, {
  GalleryI,
  PhotoProps,
  RenderImageProps,
} from "react-photo-gallery";
import * as GQL from "src/core/generated-graphql";
import { SceneWallItem } from "src/components/Scenes/SceneWallPanel";
import { ImageWallItem } from "src/components/Images/ImageWallItem";
import {
  inboxColumns,
  inboxPositiveDimensions,
  INBOX_IMAGE_DEFAULT_DIMENSIONS,
  INBOX_PHOTO_MARGIN,
  INBOX_SCENE_DEFAULT_DIMENSIONS,
  interleaveInbox,
} from "./inboxModel";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(query.matches);
    query.addEventListener?.("change", handler);
    return () => query.removeEventListener?.("change", handler);
  }, []);

  return reduced;
}

interface IInboxSceneEntry {
  kind: "scene";
  scene: GQL.SlimSceneDataFragment;
  link: string;
  title: string;
  src: string;
  width: number;
  height: number;
  alt?: string;
  key: string;
  onError?: () => void;
}

interface IInboxImageEntry {
  kind: "image";
  image: GQL.SlimImageDataFragment;
  // Index of the image within the loaded image Inbox.
  imageIndex: number;
  src: string;
  width: number;
  height: number;
  alt?: string;
  key: string;
}

type IInboxPhoto = IInboxSceneEntry | IInboxImageEntry;

// HACK: typescript doesn't allow Gallery to accept a parameter for some reason
const InboxGallery = Gallery as unknown as GalleryI<IInboxPhoto>;

interface IInboxWall {
  scenes: GQL.SlimSceneDataFragment[];
  images: GQL.SlimImageDataFragment[];
  // Index of the opened image within the image Inbox.
  onImageOpen: (index: number) => void;
  showVideoBadge?: boolean;
}

export const InboxWall: React.FC<IInboxWall> = ({
  scenes,
  images,
  onImageOpen,
  showVideoBadge = false,
}) => {
  const history = useHistory();
  const intl = useIntl();
  const reduced = useReducedMotion();
  // Scene previews that failed to load; the entry falls back to the screenshot.
  const [erroredScenes, setErroredScenes] = useState<string[]>([]);

  const handleSceneError = useCallback((src: string) => {
    setErroredScenes((prev) => (prev.includes(src) ? prev : [...prev, src]));
  }, []);

  const mixed = useMemo(
    () => interleaveInbox(scenes, images),
    [scenes, images]
  );

  const imageIndexById = useMemo(() => {
    const map = new Map<string, number>();
    images.forEach((image, index) => map.set(image.id, index));
    return map;
  }, [images]);

  const photos = useMemo<PhotoProps<IInboxPhoto>[]>(
    () =>
      mixed.map((entry): PhotoProps<IInboxPhoto> => {
        if (entry.kind === "scene") {
          const scene = entry.item;
          const file = scene.files[0];
          const { width, height } = inboxPositiveDimensions(
            file?.width,
            file?.height,
            INBOX_SCENE_DEFAULT_DIMENSIONS
          );
          const preview = scene.paths.preview ?? "";
          const screenshot = scene.paths.screenshot ?? "";
          const src =
            !reduced && preview && !erroredScenes.includes(preview)
              ? preview
              : screenshot || preview;
          return {
            kind: "scene",
            scene,
            link: `/scenes/${scene.id}`,
            // Real title only; no filename fallback.
            title: scene.title ?? "",
            src,
            width,
            height,
            alt: scene.title ?? "",
            key: `scene-${scene.id}`,
            onError: () => handleSceneError(src),
          };
        }

        const image = entry.item;
        const file = image.visual_files[0];
        const { width, height } = inboxPositiveDimensions(
          file?.width,
          file?.height,
          INBOX_IMAGE_DEFAULT_DIMENSIONS
        );
        const preview = image.paths.preview ?? "";
        const thumbnail = image.paths.thumbnail ?? "";
        return {
          kind: "image",
          image,
          imageIndex: imageIndexById.get(image.id) ?? 0,
          src: reduced ? thumbnail || preview : preview || thumbnail,
          width,
          height,
          // Do not expose the filename.
          alt: "",
          key: `image-${image.id}`,
        };
      }),
    [mixed, imageIndexById, reduced, erroredScenes, handleSceneError]
  );

  const renderImage = useCallback(
    (props: RenderImageProps<IInboxPhoto>) => {
      const { photo } = props;
      if (photo.kind === "scene") {
        return (
          <SceneWallItem
            {...(props as unknown as React.ComponentProps<
              typeof SceneWallItem
            >)}
            maxHeight={photo.height}
            title={photo.title}
            onActivate={() => history.push(photo.link)}
            tabIndex={0}
          >
            {showVideoBadge && (
              <Badge
                variant="secondary"
                className="inbox-video-badge"
                title={intl.formatMessage({ id: "scenes" })}
              >
                <Icon icon={faVideo} />
              </Badge>
            )}
          </SceneWallItem>
        );
      }
      return (
        <ImageWallItem
          {...props}
          maxHeight={photo.height}
          onActivate={() => onImageOpen(photo.imageIndex)}
          // 0 keeps tab order in DOM (interleave) order.
          tabIndex={0}
        />
      );
    },
    [history, intl, onImageOpen, showVideoBadge]
  );

  return (
    <div className="scene-wall inbox-wall">
      {photos.length ? (
        <InboxGallery
          photos={photos}
          renderImage={renderImage}
          margin={INBOX_PHOTO_MARGIN}
          direction="column"
          columns={inboxColumns}
        />
      ) : null}
    </div>
  );
};
