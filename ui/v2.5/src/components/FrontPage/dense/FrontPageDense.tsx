import React, { useMemo } from "react";
import { useIntl } from "react-intl";
import cx from "classnames";
import { FrontPageContent, ICustomFilter } from "src/core/config";
import { useFindSavedFilter } from "src/core/StashService";
import { useConfigurationContext } from "src/hooks/Config";
import { ListFilterModel } from "src/models/list-filter/filter";
import { DenseFilterSection } from "./DenseFilterSection";
import { IDenseViewport, useDenseViewport } from "./useDenseViewport";

interface IResolvedFilter {
  viewport: IDenseViewport;
  extraRow: boolean;
}

const SavedDenseFilter: React.FC<
  IResolvedFilter & { savedFilterID: string }
> = ({ savedFilterID, viewport, extraRow }) => {
  const { configuration: config } = useConfigurationContext();
  const { loading, data } = useFindSavedFilter(savedFilterID);

  const filter = useMemo(() => {
    if (!data?.findSavedFilter) return;

    const { mode } = data.findSavedFilter;
    const ret = new ListFilterModel(mode, config);
    ret.currentPage = 1;
    ret.configureFromSavedFilter(data.findSavedFilter);
    ret.randomSeed = -1;
    return ret;
  }, [data?.findSavedFilter, config]);

  if (loading || !data?.findSavedFilter || !filter) {
    return null;
  }

  return (
    <DenseFilterSection
      mode={data.findSavedFilter.mode}
      filter={filter}
      header={data.findSavedFilter.name}
      viewport={viewport}
      extraRow={extraRow}
    />
  );
};

const CustomDenseFilter: React.FC<
  IResolvedFilter & { customFilter: ICustomFilter }
> = ({ customFilter, viewport, extraRow }) => {
  const { configuration: config } = useConfigurationContext();
  const intl = useIntl();

  const filter = useMemo(() => {
    const ret = new ListFilterModel(customFilter.mode, config);
    ret.sortBy = customFilter.sortBy;
    ret.sortDirection = customFilter.direction;
    ret.currentPage = 1;
    ret.randomSeed = -1;
    return ret;
  }, [customFilter, config]);

  const header = customFilter.message
    ? intl.formatMessage(
        { id: customFilter.message.id },
        customFilter.message.values
      )
    : customFilter.title ?? "";

  return (
    <DenseFilterSection
      mode={customFilter.mode}
      filter={filter}
      header={header}
      viewport={viewport}
      extraRow={extraRow}
    />
  );
};

const DenseContent: React.FC<
  IResolvedFilter & { content: FrontPageContent }
> = ({ content, viewport, extraRow }) => {
  switch (content.__typename) {
    case "SavedFilter":
      if (!content.savedFilterId) {
        return <div>Error: missing savedFilterId</div>;
      }
      return (
        <SavedDenseFilter
          savedFilterID={content.savedFilterId.toString()}
          viewport={viewport}
          extraRow={extraRow}
        />
      );
    case "CustomFilter":
      return (
        <CustomDenseFilter
          customFilter={content}
          viewport={viewport}
          extraRow={extraRow}
        />
      );
    default:
      return null;
  }
};

interface IFrontPageDense {
  contents: FrontPageContent[];
}

export const FrontPageDense: React.FC<IFrontPageDense> = ({ contents }) => {
  const [ref, viewport] = useDenseViewport();
  const extraRow = contents.length === 1;

  return (
    <div
      ref={ref}
      className={cx("frontpage-dense", {
        "frontpage-dense-paged": contents.length === 2,
      })}
    >
      {contents.map((content, index) => (
        <DenseContent
          key={index}
          content={content}
          viewport={viewport}
          extraRow={extraRow}
        />
      ))}
    </div>
  );
};
