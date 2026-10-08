import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "react-bootstrap";
import cx from "classnames";
import * as GQL from "src/core/generated-graphql";
import { useSceneUpdate } from "src/core/StashService";
import { useToast } from "src/hooks/Toast";
import { NamedTagName, useNamedTag } from "src/hooks/useNamedTag";

const CLASSNAME = "Scene-tag-toggles";
const CLASSNAME_BUTTON = "Scene-tag-toggle";

const sceneTagToggles: { name: NamedTagName; label: string }[] = [
  { name: "wallpaper", label: "wp" },
  { name: "wp-sexy", label: "sexy" },
];

interface IProps {
  scene: GQL.SceneDataFragment;
}

export const SceneTagToggles: React.FC<IProps> = ({ scene }) => {
  const Toast = useToast();
  const [updateScene] = useSceneUpdate();
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const wallpaper = useNamedTag("wallpaper");
  const sexy = useNamedTag("wp-sexy");

  useEffect(() => {
    setPending({});
    setOverrides({});
  }, [scene.id]);

  const currentIds = useMemo(() => scene.tags.map((t) => t.id), [scene.tags]);
  const currentNames = useMemo(
    () => new Set(scene.tags.map((t) => t.name)),
    [scene.tags]
  );

  function namedTag(name: NamedTagName) {
    return name === "wallpaper" ? wallpaper : sexy;
  }

  // sceneUpdate replaces the whole tag list, so send the current ids with the
  // toggled tag added or removed.
  async function toggle(name: NamedTagName, active: boolean) {
    if (pending[name] !== undefined) return;

    setPending((prev) => ({ ...prev, [name]: !active }));
    setOverrides((prev) => ({ ...prev, [name]: !active }));
    try {
      const tag = await namedTag(name).ensureTag();
      const nextIds = active
        ? currentIds.filter((id) => id !== tag.id)
        : Array.from(new Set([...currentIds, tag.id]));
      await updateScene({
        variables: { input: { id: scene.id, tag_ids: nextIds } },
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
      {sceneTagToggles.map(({ name, label }) => {
        const active = overrides[name] ?? currentNames.has(name);
        const busy = pending[name] !== undefined || namedTag(name).loading;

        return (
          <Badge
            key={name}
            as="button"
            type="button"
            className={cx(CLASSNAME_BUTTON, "tag-item", {
              "is-on": active,
              "is-off": !active,
              wallpaper: name === "wallpaper",
              sexy: name === "wp-sexy",
            })}
            disabled={busy}
            title={name}
            onClick={() => toggle(name, active)}
          >
            {label}
          </Badge>
        );
      })}
    </div>
  );
};
