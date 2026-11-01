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
import { Form, type FormItemProps } from 'antd';
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
  tooltip,
  rules,
}: {
  Component: ComponentType<RuntimeMaterialProps>;
  props: RuntimeMaterialProps;
  name: string;
  label?: string;
  required?: boolean;
  field: string;
  tooltip?: string;
  rules?: FormItemProps['rules'];
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
      tooltip={tooltip}
      required={required}
      valuePropName={field}
      rules={
        required
          ? [
              ...(rules ?? []),
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
          : rules
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
    const {
      fieldName,
      fieldLabel,
      fieldRequired,
      fieldTooltip,
      fieldRules,
      init,
      alias,
      tabKey,
      ...rest
    } = props;
    const formContext = useContext(FormRuntimeContext);
    const initialized = useRef(false);
    useEffect(() => {
      if (!initialized.current && props.om_mode !== 'design') {
        initialized.current = true;
        if (typeof init === 'function') init();
      }
    }, [init, props.om_mode]);
    if (!supportsField || !formContext) return <Component {...rest} />;
    const label = typeof fieldLabel === 'string' ? fieldLabel : undefined;
    const tooltip = typeof fieldTooltip === 'string' ? fieldTooltip : undefined;
    if (props.om_mode === 'design')
      return (
        <Form.Item label={label} tooltip={tooltip} required={Boolean(fieldRequired)}>
          <Component {...rest} />
        </Form.Item>
      );
    if (typeof fieldName !== 'string' || !fieldName) return <Component {...rest} />;
    const rules: FormItemProps['rules'] = Array.isArray(fieldRules)
      ? fieldRules.map((rule) => {
          const { type, value, message } = rule as {
            type: string;
            value?: string | number;
            message?: string;
          };
          if (type === 'email' || type === 'url') return { type, message };
          if (type === 'pattern') {
            try {
              return { pattern: new RegExp(String(value)), message };
            } catch {
              return { validator: () => Promise.reject(new Error(message || '正则表达式无效')) };
            }
          }
          if (type === 'minLength' || type === 'maxLength')
            return {
              type: 'string' as const,
              [type === 'minLength' ? 'min' : 'max']: Number(value),
              message,
            };
          return { type: 'number' as const, [type]: Number(value), message };
        })
      : [];
    return (
      <RuntimeField
        Component={Component}
        props={rest}
        name={fieldName}
        required={Boolean(fieldRequired)}
        label={typeof fieldLabel === 'string' ? fieldLabel : undefined}
        field={field}
        tooltip={tooltip}
        rules={rules}
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
