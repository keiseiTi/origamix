import React from 'react';
import { Slider as AntdSlider, type SliderSingleProps, type SliderRangeProps } from 'antd';
import type { RuntimeMaterialProps } from '@';

export type IProps = (SliderSingleProps | SliderRangeProps) &
  RuntimeMaterialProps & {
    defaultStart?: number;
    defaultEnd?: number;
    draggableTrack?: boolean;
    tooltipMode?: 'auto' | 'always' | 'hidden';
    tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  };
export const Slider = ({
  defaultStart,
  defaultEnd,
  draggableTrack,
  tooltipMode,
  tooltipPlacement,
  tooltip,
  tg_setContextValues,
  ...rest
}: IProps) => {
  const configuredTooltip = {
    ...tooltip,
    ...(tooltipMode ? { open: tooltipMode === 'auto' ? undefined : tooltipMode === 'always' } : {}),
    ...(tooltipPlacement ? { placement: tooltipPlacement } : {}),
  };
  if (rest.range) {
    const initial =
      defaultStart !== undefined || defaultEnd !== undefined
        ? [defaultStart ?? rest.min ?? 0, defaultEnd ?? rest.max ?? 100]
        : Array.isArray(rest.defaultValue)
          ? rest.defaultValue
          : [rest.min ?? 0, rest.max ?? 100];
    return (
      <AntdSlider
        key={`range:${defaultStart}:${defaultEnd}:${JSON.stringify(rest.defaultValue)}`}
        {...rest}
        range={{
          ...(typeof rest.range === 'object' ? rest.range : {}),
          ...(draggableTrack !== undefined ? { draggableTrack } : {}),
        }}
        defaultValue={initial}
        tooltip={configuredTooltip}
        style={{ ...(rest.vertical ? { height: 160 } : { minWidth: 160 }), ...rest.style }}
      />
    );
  }
  return (
    <AntdSlider
      key={`single:${rest.defaultValue}`}
      {...rest}
      range={false}
      tooltip={configuredTooltip}
      style={{ ...(rest.vertical ? { height: 160 } : { minWidth: 160 }), ...rest.style }}
    />
  );
};
export default Slider;
