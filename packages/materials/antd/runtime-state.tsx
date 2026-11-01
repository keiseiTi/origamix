import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useLayoutEffect,
  useState,
  type ComponentType,
} from 'react';
import { Form } from 'antd';
import type { MaterialManifest } from '@origamix/shared';
import type { RuntimeMaterialProps } from '../src/runtime-material';

export const FormRuntimeContext = createContext<{
  sync: () => void;
  register: (name: string, publish: (value: unknown) => void) => () => void;
} | null>(null);
export const useRuntimeValue = <T,>(
  field: string,
  supplied: T | undefined,
  initial: T | (() => T),
  publish: RuntimeMaterialProps['om_setRuntimeState'],
): [T, (next: T) => void] => {
  const [fallback] = useState(initial);
  const [value, setValue] = useState<T>(() => (supplied === undefined ? fallback : supplied));
  useLayoutEffect(() => {
    const next = supplied === undefined ? fallback : supplied;
    setValue(next);
    publish?.({ [field]: next });
  }, [field, supplied, publish, fallback]);
  const change = useCallback(
    (next: T) => {
      setValue(next);
      publish?.({ [field]: next });
    },
    [field, publish],
  );
  return [value, change];
};

const RuntimeField = ({
  Component,
  props,
  name,
  label,
  required,
  field,
}: {
  Component: ComponentType<RuntimeMaterialProps>;
  props: RuntimeMaterialProps;
  name: string;
  label?: string;
  required?: boolean;
  field: string;
}) => {
  const form = Form.useFormInstance();
  const context = useContext(FormRuntimeContext);
  const initial = useRef<{ value: unknown } | null>(null);
  const publish = useCallback(
    (patch: Record<string, unknown>) => {
      if (Object.hasOwn(patch, field) && !initial.current) {
        initial.current = { value: patch[field] };
        if (form.getFieldValue(name) === undefined) form.setFieldValue(name, patch[field]);
      }
      props.om_setRuntimeState?.(patch);
    },
    [field, form, name, props.om_setRuntimeState],
  );
  useLayoutEffect(() => {
    const unregister = context?.register(name, (value) => {
      const next = value === undefined ? initial.current?.value : value;
      // resetFields clears Form's store; restore the component's published default there too.
      if (value === undefined && initial.current) form.setFieldValue(name, next);
      props.om_setRuntimeState?.({ [field]: next });
    });
    props.om_setContextActions?.({
      $writeField: (value: unknown) => {
        form.setFieldValue(name, value);
        context?.sync();
      },
    });
    context?.sync();
    return () => {
      unregister?.();
      props.om_setContextActions?.({ $writeField: undefined });
    };
  }, [context, field, form, name, props.om_setContextActions, props.om_setRuntimeState]);
  return (
    <Form.Item
      name={name}
      label={label}
      valuePropName={field}
      rules={
        required
          ? [
              {
                validator: (_rule, value: unknown) =>
                  value === null ||
                  value === undefined ||
                  value === '' ||
                  (Array.isArray(value) &&
                    (!value.length || value.every((item) => item === null || item === undefined)))
                    ? Promise.reject(new Error(`${label || name}不能为空`))
                    : Promise.resolve(),
              },
            ]
          : []
      }
      getValueFromEvent={(payload: Record<string, unknown>) => payload[field]}
    >
      <Component {...props} om_setRuntimeState={publish} />
    </Form.Item>
  );
};

/** The runtime entry attaches only its pure capability data and a Form field boundary. */
export const registerRuntimeMaterial = (component: unknown, manifest: MaterialManifest) => {
  const Component = component as ComponentType<RuntimeMaterialProps>;
  const field = manifest.valueProp ?? 'value';
  const supportsField = Object.hasOwn(manifest.propsSchema.properties ?? {}, 'fieldName');
  const BoundMaterial = (props: RuntimeMaterialProps) => {
    const { fieldName, fieldLabel, fieldRequired, init, alias, tabKey, ...rest } = props;
    const initialized = useRef(false);
    useEffect(() => {
      if (!initialized.current && props.om_mode !== 'design') {
        initialized.current = true;
        if (typeof init === 'function') init();
      }
    }, [init, props.om_mode]);
    if (!supportsField || typeof fieldName !== 'string' || !fieldName || props.om_mode === 'design')
      return <Component {...rest} />;
    return (
      <RuntimeField
        Component={Component}
        props={rest}
        name={fieldName}
        required={Boolean(fieldRequired)}
        label={typeof fieldLabel === 'string' ? fieldLabel : undefined}
        field={field}
      />
    );
  };
  return Object.assign(BoundMaterial, {
    origamixLayout: manifest.layout,
    origamixRuntime: {
      context: manifest.context,
      defaultProps: manifest.defaultProps,
      role: manifest.role,
      valueProp: manifest.valueProp,
    },
  });
};
