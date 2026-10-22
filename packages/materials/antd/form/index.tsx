import { FormRuntimeContext } from '../runtime-state';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Form as AntdForm, theme, type FormProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

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
    onFinish,
    onFinishFailed,
    tg_mode,
    tg_readonly,
    tg_dropPlaceholder,
    tg_setContextValues,
    tg_setRuntimeState,
    ...restProps
  } = props;
  const [form] = AntdForm.useForm();
  const { token } = theme.useToken();
  const fieldPublishers = useRef(new Map<string, (value: unknown) => void>());
  const publish = useCallback(() => {
    const values = form.getFieldsValue(true);
    tg_setRuntimeState?.({ value: values });
    for (const [name, send] of fieldPublishers.current) send(values[name]);
  }, [form, tg_setRuntimeState]);
  const fieldContext = useMemo(
    () => ({
      sync: publish,
      register: (name: string, send: (value: unknown) => void) => {
        fieldPublishers.current.set(name, send);
        return () => {
          fieldPublishers.current.delete(name);
        };
      },
    }),
    [publish],
  );

  useEffect(() => {
    if (value) {
      form.setFieldsValue({
        ...value,
      });
    }
  }, [value, form]);

  useLayoutEffect(() => {
    tg_setContextValues?.({
      setFieldsValue: (fields: Record<string, unknown>) => {
        form.setFieldsValue(fields);
        publish();
      },
      validateFields: async () => {
        const result = await form.validateFields();
        publish();
        return result;
      },
      resetFields: (fields?: string[]) => {
        form.resetFields(fields);
        publish();
      },
    });
    publish();
  }, [form, tg_setContextValues, publish]);

  const onValuesChange = (_: Record<string, unknown>, allValues: Record<string, unknown>) => {
    tg_setRuntimeState?.({ value: allValues });
    onValuesChangeProp?.(_, allValues);
  };

  return (
    <FormRuntimeContext.Provider value={fieldContext}>
      <AntdForm
        className='w-full'
        form={form}
        onValuesChange={onValuesChange}
        onFinish={(values) => {
          tg_setRuntimeState?.({ value: values });
          onFinish?.(values);
        }}
        onFinishFailed={(info) => {
          tg_setRuntimeState?.({ value: info.values });
          onFinishFailed?.(info);
        }}
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
    </FormRuntimeContext.Provider>
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
