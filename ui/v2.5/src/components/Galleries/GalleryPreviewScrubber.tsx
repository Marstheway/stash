import React, { useEffect, useState } from "react";
import { useThrottle } from "src/hooks/throttle";
import { HoverScrubber } from "../Shared/HoverScrubber";
import cx from "classnames";

export const GalleryPreviewScrubber: React.FC<{
  className?: string;
  previewPath: string;
  defaultPath: string;
  imageCount: number;
  onClick?: (imageIndex: number) => void;
  onPathChanged: React.Dispatch<React.SetStateAction<string | undefined>>;
  useOriginal?: boolean;
}> = ({
  className,
  previewPath,
  defaultPath,
  imageCount,
  onClick,
  onPathChanged,
  useOriginal = false,
}) => {

  const [activeIndex, setActiveIndex] = useState<number>();
  const debounceSetActiveIndex = useThrottle(setActiveIndex, 50);

  function onScrubberClick(index: number) {
    if (!onClick) {
      return;
    }

    onClick(index);
  }

  useEffect(() => {
    function getPath() {
      if (activeIndex === undefined) {
        return defaultPath;
      }

      // If useOriginal is true, modify the path to use the original image instead of preview
      if (useOriginal) {
        // Replace /preview/ with /image/ in the path to get the original image
        // This assumes the API follows the same pattern for image URLs
        const originalPath = previewPath.replace('/preview/', '/image/');
        return `${originalPath}/${activeIndex}`;
      }

      return `${previewPath}/${activeIndex}`;
    }

    onPathChanged(getPath());
  }, [activeIndex, defaultPath, previewPath, onPathChanged, useOriginal]);


  return (
    <div className={cx("preview-scrubber", className)}>
      <HoverScrubber
        totalSprites={imageCount}
        activeIndex={activeIndex}
        setActiveIndex={(i) => debounceSetActiveIndex(i)}
        onClick={onScrubberClick}
      />
    </div>
  );
};
