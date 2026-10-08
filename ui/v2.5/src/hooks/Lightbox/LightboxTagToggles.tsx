import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import cx from "classnames";
import {
  faHeart as fasHeart,
  faImage as fasImage,
} from "@fortawesome/free-solid-svg-icons";
import {
  faHeart as farHeart,
  faImage as farImage,
} from "@fortawesome/free-regular-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import * as GQL from "src/core/generated-graphql";
import { useBulkImageUpdate } from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { NamedTagName, useNamedTag } from "src/hooks/useNamedTag";
import { ILightboxImage } from "./types";
import { lightboxTagToggles } from "./lightbox_local";

const CLASSNAME = "Lightbox-tag-toggles";
const CLASSNAME_BUTTON = "Lightbox-tag-toggle";

interface IProps {
  image: ILightboxImage;
}

export const LightboxTagToggles: React.FC<IProps> = ({ image }) => {
  const Toast = useToast();
  const [bulkUpdate] = useBulkImageUpdate();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const wallpaper = useNamedTag("wallpaper");
  const sexy = useNamedTag("wp-sexy");

  useEffect(() => {
    setPending({});
    setOverrides({});
  }, [image.id]);

  if (!image.id) {
    return null;
  }

  const currentNames = new Set((image.tags ?? []).map((t) => t.name));

  function namedTag(name: NamedTagName) {
    return name === "wallpaper" ? wallpaper : sexy;
  }

  async function toggle(name: NamedTagName, active: boolean) {
    if (!image.id) return;
    if (pending[name] !== undefined) return;

    setPending((prev) => ({ ...prev, [name]: !active }));
    setOverrides((prev) => ({ ...prev, [name]: !active }));
    try {
      const tag = await namedTag(name).ensureTag();
      await bulkUpdate({
        variables: {
          input: {
            ids: [image.id],
            tag_ids: {
              ids: [tag.id],
              mode: active
                ? GQL.BulkUpdateIdMode.Remove
                : GQL.BulkUpdateIdMode.Add,
            },
          },
        },
      });
    } catch (e) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      Toast.error(e);
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  return (
    <div className={CLASSNAME}>
      {lightboxTagToggles.map(({ name, label, kind }) => {
        const active = overrides[name] ?? currentNames.has(name);
        const lookupLoading = namedTag(name).loading;
        const busy = pending[name] !== undefined || lookupLoading;
        const onIcon = kind === "wallpaper" ? fasImage : fasHeart;
        const offIcon = kind === "wallpaper" ? farImage : farHeart;

        return (
          <Button
            key={name}
            className={cx("minimal", CLASSNAME_BUTTON, kind, {
              "is-on": active,
              "is-off": !active,
            })}
            title={label}
            disabled={busy}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              toggle(name, active);
            }}
          >
            <Icon icon={active ? onIcon : offIcon} />
          </Button>
        );
      })}
    </div>
  );
};
