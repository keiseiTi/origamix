import React, { useEffect } from 'react';
import { Form as AntdForm, theme, type FormProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '../../src/runtime-material';

export interface IProps extends FormProps, MaterialComponentProps {
  children?: React.ReactNode;
  labelColVal?: number;
  wrapperColVal?: number;
  value?: Record<string, unknown>;
}

const FormContent = (props: IProps) => {
  const {
    children,
    labelColVal,
    wrapperColVal,
    value,
    onValuesChange: onValuesChangeProp,
    tg_mode,
    tg_readonly,
    tg_dropPlaceholder,
    tg_setContextValues,
    ...restProps
  } = props;
  const [form] = AntdForm.useForm();
  const { token } = theme.useToken();

  useEffect(() => {
    if (value) {
      form.setFieldsValue({
        ...value,
      });
    }
  }, [value, form]);

  useEffect(() => {
    tg_setContextValues?.({
      setFieldsValue: form.setFieldsValue,
      validateFields: form.validateFields,
      resetFields: form.resetFields,
    });
  }, [form, tg_setContextValues]);

  const onValuesChange = (_: Record<string, unknown>, allValues: Record<string, unknown>) => {
    tg_setContextValues?.({
      value: allValues,
    });
    onValuesChangeProp?.(_, allValues);
  };

  return (
    <AntdForm
      className='w-full'
      form={form}
      onValuesChange={onValuesChange}
      labelCol={
        labelColVal !== undefined
          ? {
              span: labelColVal,
            }
          : undefined
      }
      wrapperCol={
        wrapperColVal !== undefined
          ? {
              span: wrapperColVal,
            }
          : undefined
      }
      {...restProps}
      style={{
        backgroundColor: token.colorBgContainer,
        color: token.colorText,
        ...restProps.style,
      }}
    >
      {children ?? tg_dropPlaceholder}
    </AntdForm>
  );
};

export const Form = React.forwardRef<HTMLDivElement, IProps>((props, ref) => {
  return (
    <div ref={ref} className='min-h-12 w-full'>
      <FormContent
        key={props.tg_mode === 'design' ? JSON.stringify(props.initialValues) : undefined}
        {...props}
      />
    </div>
  );
});

export default Form;
