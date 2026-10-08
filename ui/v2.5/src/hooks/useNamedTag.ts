// Local-only helper. Resolves a tag by its exact name — and creates it on
// demand — so the wallpaper / sexy toggles in the lightbox and on the scene
// detail page share one implementation.

import { useCallback, useState } from "react";
import * as GQL from "src/core/generated-graphql";
import { useTagCreate } from "src/core/StashService";

export type NamedTagName = "wallpaper" | "wp-sexy";

export interface INamedTag {
  id: string;
  name: string;
}

export function useNamedTag(name: NamedTagName) {
  const [createTag] = useTagCreate();
  const [created, setCreated] = useState<INamedTag>();

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

  const tag = data?.findTags?.tags.find((t) => t.name === name) ?? created;

  const ensureTag = useCallback(async (): Promise<INamedTag> => {
    if (tag) return tag;

    const result = await createTag({ variables: { input: { name } } });
    const createdTag = result.data?.tagCreate;
    if (!createdTag) {
      throw new Error(`无法创建 tag「${name}」`);
    }

    const next = { id: createdTag.id, name: createdTag.name };
    setCreated(next);
    return next;
  }, [tag, createTag, name]);

  return { tag, loading, ensureTag };
}
