import { Slider as AntdSlider, type SliderSingleProps, type SliderRangeProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { useRuntimeValue } from '../runtime-state';
export type IProps = (SliderSingleProps | SliderRangeProps) &
  RuntimeMaterialProps & {
    defaultStart?: number;
    defaultEnd?: number;
    draggableTrack?: boolean;
    tooltipMode?: 'auto' | 'always' | 'hidden';
    tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  };
export const Slider = ({
  value,
  defaultValue,
  defaultStart,
  defaultEnd,
  draggableTrack,
  tooltipMode,
  tooltipPlacement,
  fieldName,
  fieldLabel,
  om_setRuntimeState,
  om_mode,
  om_readonly,
  om_dropPlaceholder,
  om_setContextValues,
  ...rest
}: IProps) => {
  const [current, change] = useRuntimeValue<number | number[]>(
    'value',
    value,
    rest.range
      ? [defaultStart ?? rest.min ?? 0, defaultEnd ?? rest.max ?? 100]
      : (defaultValue ?? rest.min ?? 0),
    om_setRuntimeState,
  );
  const tooltip = {
    ...rest.tooltip,
    ...(tooltipMode ? { open: tooltipMode === 'auto' ? undefined : tooltipMode === 'always' } : {}),
    ...(tooltipPlacement ? { placement: tooltipPlacement } : {}),
  };
  if (rest.range)
    return (
      <AntdSlider
        {...(rest as SliderRangeProps)}
        range={{ draggableTrack }}
        value={current as number[]}
        tooltip={tooltip}
        onChange={(next: number[]) => {
          change(next);
          (rest.onChange as SliderRangeProps['onChange'])?.(next);
        }}
        onChangeComplete={(next: number[]) => {
          change(next);
          (rest.onChangeComplete as SliderRangeProps['onChangeComplete'])?.(next);
        }}
        style={rest.vertical ? { height: 160 } : { minWidth: 160 }}
      />
    );
  return (
    <AntdSlider
      {...(rest as SliderSingleProps)}
      range={false}
      value={current as number}
      tooltip={tooltip}
      onChange={(next) => {
        change(next);
        (rest.onChange as SliderSingleProps['onChange'])?.(next);
      }}
      onChangeComplete={(next) => {
        change(next);
        (rest.onChangeComplete as SliderSingleProps['onChangeComplete'])?.(next);
      }}
      style={rest.vertical ? { height: 160 } : { minWidth: 160 }}
    />
  );
};
export default Slider;
