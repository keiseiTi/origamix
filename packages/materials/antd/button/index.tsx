import type { MaterialEventProps } from '../../src/runtime-material';
import { useLayoutEffect } from 'react';
import { Button as AntdButton, type ButtonProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export interface IProps
  extends
    MaterialEventProps<
      Pick<
        ButtonProps,
        | 'disabled'
        | 'loading'
        | 'onClick'
        | 'type'
        | 'href'
        | 'target'
        | 'ghost'
        | 'size'
        | 'danger'
        | 'block'
      >,
      'onClick'
    >,
    MaterialComponentProps {
  text?: string;
}

export const Button = (props: IProps) => {
  const {
    text,
    loading = false,
    onClick,
    om_setContextActions,
    fieldName,
    fieldLabel,
    om_setRuntimeState,
    om_mode,
    om_readonly,
    om_dropPlaceholder,
    ...restProps
  } = props;
  useLayoutEffect(() => {
    om_setRuntimeState?.({ loading: Boolean(loading) });
  }, [loading, om_setRuntimeState]);
  return (
    <AntdButton {...restProps} loading={loading} onClick={() => onClick?.({ action: 'click' })}>
      {text}
    </AntdButton>
  );
};

export default Button;
