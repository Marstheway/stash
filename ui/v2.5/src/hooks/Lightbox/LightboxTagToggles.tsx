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
import { useBulkImageUpdate, useTagCreate } from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { ILightboxImage } from "./types";
import { lightboxTagToggles } from "./lightbox_local";

const CLASSNAME = "Lightbox-tag-toggles";
const CLASSNAME_BUTTON = "Lightbox-tag-toggle";

interface INamedTag {
  id: string;
  name: string;
}

interface IProps {
  image: ILightboxImage;
}

function useNamedTag(name: string) {
  const { data, loading } = GQL.useFindTagsForSelectQuery({
    variables: {
      filter: { per_page: 5 },
      tag_filter: {
        name: {
          value: name,
          modifier: GQL.CriterionModifier.Equals,
        },
      },
    },
  });

  const tag = data?.findTags?.tags.find((t) => t.name === name);
  return { tag, loading };
}

export const LightboxTagToggles: React.FC<IProps> = ({ image }) => {
  const Toast = useToast();
  const [bulkUpdate] = useBulkImageUpdate();
  const [createTag] = useTagCreate();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [created, setCreated] = useState<Record<string, INamedTag>>({});

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

  function resolvedTag(name: "wallpaper" | "wp-sexy"): INamedTag | undefined {
    if (name === "wallpaper") return wallpaper.tag ?? created[name];
    return sexy.tag ?? created[name];
  }

  async function ensureTag(name: "wallpaper" | "wp-sexy"): Promise<INamedTag> {
    const existing = resolvedTag(name);
    if (existing) return existing;

    const result = await createTag({
      variables: { input: { name } },
    });
    const tag = result.data?.tagCreate;
    if (!tag) {
      throw new Error(`无法创建 tag「${name}」`);
    }
    const createdTag = { id: tag.id, name: tag.name };
    setCreated((prev) => ({ ...prev, [name]: createdTag }));
    return createdTag;
  }

  async function toggle(name: "wallpaper" | "wp-sexy", active: boolean) {
    if (!image.id) return;
    if (pending[name] !== undefined) return;

    setPending((prev) => ({ ...prev, [name]: !active }));
    setOverrides((prev) => ({ ...prev, [name]: !active }));
    try {
      const tag = await ensureTag(name);
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
        const lookupLoading =
          name === "wallpaper" ? wallpaper.loading : sexy.loading;
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
