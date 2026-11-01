import type { MaterialEventProps } from '../../src/runtime-material';
import { Slider as AntdSlider, type SliderSingleProps, type SliderRangeProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { useRuntimeValue } from '../runtime-state';
export type IProps = (
  | MaterialEventProps<SliderSingleProps, 'onChange' | 'onChangeComplete'>
  | MaterialEventProps<SliderRangeProps, 'onChange' | 'onChangeComplete'>
) &
  RuntimeMaterialProps & {
    defaultStart?: number;
    defaultEnd?: number;
    draggableTrack?: boolean;
    tooltipMode?: 'auto' | 'always' | 'hidden';
    tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  };
export const Slider = (props: IProps) => {
  const {
    value,
    defaultValue,
    defaultStart,
    defaultEnd,
    draggableTrack,
    tooltipMode,
    tooltipPlacement,
    onChange,
    onChangeComplete,
    fieldName,
    fieldLabel,
    om_setRuntimeState,
    om_mode,
    om_readonly,
    om_dropPlaceholder,
    om_setContextActions,
    ...rest
  } = props;

  const [current, change] = useRuntimeValue<number | number[]>(
    'value',
    value,
    props.range
      ? [defaultStart ?? props.min ?? 0, defaultEnd ?? props.max ?? 100]
      : (defaultValue ?? props.min ?? 0),
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
          onChange?.({ value: next });
        }}
        onChangeComplete={(next: number[]) => {
          change(next);
          onChangeComplete?.({ value: next });
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
        onChange?.({ value: next });
      }}
      onChangeComplete={(next) => {
        change(next);
        onChangeComplete?.({ value: next });
      }}
      style={rest.vertical ? { height: 160 } : { minWidth: 160 }}
    />
  );
};
export default Slider;
