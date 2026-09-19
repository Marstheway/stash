import React, { useContext, useMemo } from "react";
import { View } from "src/components/List/views";
import { IUIConfig } from "src/core/config";
import { SavedUIOptions } from "src/models/list-filter/types";

interface IGalleryDetailsLayout {
  collapsed: boolean;
}

const GalleryDetailsLayoutContext =
  React.createContext<IGalleryDetailsLayout | null>(null);

export const GalleryDetailsLayoutProvider: React.FC<IGalleryDetailsLayout> = ({
  collapsed,
  children,
}) => {
  const value = useMemo(() => ({ collapsed }), [collapsed]);

  return (
    <GalleryDetailsLayoutContext.Provider value={value}>
      {children}
    </GalleryDetailsLayoutContext.Provider>
  );
};

export function readGallerySidebarCollapsed(ui?: IUIConfig): boolean {
  return (
    ui?.defaultFilters?.[View.GalleryImages]?.ui_options?.sidebar_collapsed ===
    true
  );
}

export function useGalleryLayoutUIOptions(view?: View): SavedUIOptions {
  const layout = useContext(GalleryDetailsLayoutContext);

  if (view !== View.GalleryImages || !layout) {
    return {};
  }

  return { sidebar_collapsed: layout.collapsed };
}
