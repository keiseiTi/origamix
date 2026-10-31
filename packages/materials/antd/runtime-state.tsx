import {
  createContext,
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
import { serializeDateValue, serializeTimeValue } from './date-value';

export const FormRuntimeContext = createContext<{
  sync: () => void;
  register: (name: string, publish: (value: unknown) => void) => () => void;
} | null>(null);
export const useRuntimeValue = <T,>(
  field: string,
  supplied: T | undefined,
  initial: T,
  publish: RuntimeMaterialProps['om_setRuntimeState'],
): [T, (next: T) => void] => {
  const [fallback] = useState(initial);
  const [value, setValue] = useState<T>(supplied === undefined ? initial : supplied);
  useLayoutEffect(() => {
    const next = supplied === undefined ? fallback : supplied;
    setValue(next);
    publish?.({ [field]: next });
  }, [field, supplied, publish, fallback]);
  return [
    value,
    (next) => {
      setValue(next);
      publish?.({ [field]: next });
    },
  ];
};

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
export const fileDescriptions = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.map((file) => {
        const data = object(file);
        return Object.fromEntries(
          ['uid', 'name', 'status', 'percent', 'url', 'size', 'type']
            .filter((key) => data[key] !== undefined)
            .map((key) => [key, data[key]]),
        );
      })
    : [];
const eventPayload = (
  type: string,
  event: string,
  args: unknown[],
  props: Record<string, unknown> = {},
): unknown => {
  const withTime = Boolean(props.showTime) && (!props.picker || props.picker === 'date');
  const first = object(args[0]);
  if (type === 'input' || type === 'textarea')
    return {
      value: object(first.target).value ?? '',
      ...(event === 'onPressEnter' ? { key: 'Enter' } : {}),
    };
  if (type === 'number')
    return event === 'onPressEnter'
      ? { value: props.value ?? null, key: 'Enter' }
      : { value: args[0] ?? null };
  if (type === 'radio') return { value: object(first.target).value ?? null };
  if (type === 'switch') return { checked: Boolean(args[0]) };
  if (type === 'datePicker') return { value: serializeDateValue(args[0], withTime) };
  if (type === 'datePickerRange')
    return {
      value: Array.isArray(args[0])
        ? args[0].map((value) => serializeDateValue(value, withTime))
        : [null, null],
    };
  if (type === 'timePicker') return { value: serializeTimeValue(args[0]) };
  if (type === 'table')
    return {
      pagination: { current: first.current, pageSize: first.pageSize, total: first.total },
      action: object(args[3]).action ?? 'paginate',
    };
  if (type === 'upload')
    return event === 'onRemove'
      ? { file: fileDescriptions([args[0]])[0] }
      : { file: fileDescriptions([first.file])[0], fileList: fileDescriptions(first.fileList) };
  if (type === 'tabs')
    return event === 'onEdit'
      ? { action: args[1], targetKey: typeof args[0] === 'string' ? args[0] : null }
      : { activeKey: args[0] };
  if (type === 'tree')
    return {
      [event === 'onSelect'
        ? 'selectedKeys'
        : event === 'onCheck'
          ? 'checkedKeys'
          : 'expandedKeys']: Array.isArray(args[0]) ? args[0] : (first.checked ?? []),
    };
  if (type === 'form')
    return event === 'onValuesChange'
      ? { changedValues: args[0], value: args[1] }
      : event === 'onFinish'
        ? { value: args[0] }
        : { value: first.values, errors: first.errorFields };
  if (type === 'modal' || type === 'drawer')
    return event === 'afterOpenChange' ? { open: Boolean(args[0]) } : { action: event };
  if (['button', 'text'].includes(type)) return { action: 'click' };
  return { value: args[0] ?? null };
};
const initialState = (type: string, props: Record<string, unknown>): Record<string, unknown> => {
  if (['input', 'textarea'].includes(type))
    return { value: props.value ?? props.defaultValue ?? '' };
  if (type === 'number') return { value: props.value ?? props.defaultValue ?? null };
  if (type === 'checkbox') return { value: props.value ?? props.defaultValue ?? [] };
  if (['radio', 'select', 'treeSelect'].includes(type))
    return {
      value:
        props.value ??
        props.defaultValue ??
        (props.mode || props.multiple || props.treeCheckable ? [] : null),
    };
  if (type === 'switch') return { checked: props.checked ?? props.defaultChecked ?? false };
  if (type === 'slider')
    return {
      value:
        props.value ??
        (props.range
          ? [props.defaultStart ?? props.min ?? 0, props.defaultEnd ?? props.max ?? 100]
          : (props.defaultValue ?? props.min ?? 0)),
    };
  if (type === 'datePicker')
    return {
      value: serializeDateValue(
        props.value ?? props.defaultValue,
        Boolean(props.showTime) && (!props.picker || props.picker === 'date'),
      ),
    };
  if (type === 'datePickerRange')
    return {
      value: (Array.isArray(props.value)
        ? props.value
        : [props.defaultStart ?? null, props.defaultEnd ?? null]
      ).map((value) =>
        serializeDateValue(
          value,
          Boolean(props.showTime) && (!props.picker || props.picker === 'date'),
        ),
      ),
    };
  if (type === 'timePicker')
    return { value: serializeTimeValue(props.value ?? props.defaultValue) };
  if (type === 'cascader') return { value: props.value ?? props.defaultValue ?? [] };
  if (type === 'tree')
    return {
      selectedKeys: props.selectedKeys ?? props.defaultSelectedKeys ?? [],
      checkedKeys: props.checkedKeys ?? props.defaultCheckedKeys ?? [],
      expandedKeys:
        props.expandedKeys ??
        (props.defaultExpandAll
          ? (() => {
              const keys: unknown[] = [];
              const visit = (nodes: unknown[]) =>
                nodes.forEach((node) => {
                  const item = object(node);
                  keys.push(item.key);
                  if (Array.isArray(item.children)) visit(item.children);
                });
              visit(Array.isArray(props.treeData) ? props.treeData : []);
              return keys;
            })()
          : (props.defaultExpandedKeys ?? [])),
    };
  if (type === 'tabs')
    return {
      activeKey:
        props.activeKey ??
        props.defaultActiveKey ??
        object((props.items as unknown[])?.[0]).key ??
        null,
    };
  if (type === 'form') return { value: props.value ?? props.initialValues ?? {} };
  if (type === 'table')
    return {
      loading: props.loading ?? false,
      pagination:
        props.pagination === false || props.pagination === undefined
          ? false
          : {
              current: 1,
              pageSize: 10,
              ...object(props.pagination),
              total: (props.dataSource as unknown[])?.length ?? 0,
            },
    };
  if (type === 'upload') return { fileList: [] };
  if (type === 'button') return { loading: props.loading ?? false };
  if (type === 'modal' || type === 'drawer') return { open: props.open ?? false };
  return {};
};

const RuntimeField = ({
  Component,
  props,
  name,
  label,
  required,
  type,
}: {
  Component: ComponentType<RuntimeMaterialProps>;
  props: RuntimeMaterialProps;
  name: string;
  label?: string;
  required?: boolean;
  type: string;
}) => {
  const form = Form.useFormInstance();
  const context = useContext(FormRuntimeContext);
  const field = type === 'switch' ? 'checked' : 'value';
  const [fieldInitial] = useState(() =>
    form.getFieldValue(name) === undefined ? initialState(type, props)[field] : undefined,
  );
  useLayoutEffect(() => {
    const unregister = context?.register(name, (value) =>
      props.om_setRuntimeState?.({ [field]: value ?? initialState(type, props)[field] }),
    );
    props.om_setContextActions?.({
      $writeField: (value: unknown) => {
        form.setFieldValue(name, value);
        context?.sync();
      },
    });
    return () => {
      unregister?.();
      props.om_setContextActions?.({ $writeField: undefined });
    };
  }, [context, field, form, name, props.om_setContextActions, props.om_setRuntimeState, type]);
  return (
    <Form.Item
      name={name}
      label={label}
      valuePropName={field}
      initialValue={fieldInitial}
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
      getValueFromEvent={(...args: unknown[]) =>
        (eventPayload(type, 'onChange', args, props) as Record<string, unknown>)[field]
      }
    >
      <Component {...props} />
    </Form.Item>
  );
};

/** The runtime entry attaches only its pure capability data and a Form field boundary. */
export const registerRuntimeMaterial = (component: unknown, manifest: MaterialManifest) => {
  const Component = component as ComponentType<RuntimeMaterialProps>;
  const BoundMaterial = (props: RuntimeMaterialProps) => {
    const { fieldName, fieldLabel, fieldRequired, init, alias, tabKey, ...rest } = props;
    const initialized = useRef(false);
    useEffect(() => {
      if (!initialized.current && props.om_mode !== 'design') {
        initialized.current = true;
        if (typeof init === 'function') init();
      }
    }, [init, props.om_mode]);
    if (typeof fieldName !== 'string' || !fieldName || props.om_mode === 'design')
      return <Component {...rest} />;
    return (
      <RuntimeField
        Component={Component}
        props={rest}
        name={fieldName}
        required={Boolean(fieldRequired)}
        label={typeof fieldLabel === 'string' ? fieldLabel : undefined}
        type={manifest.type}
      />
    );
  };
  return Object.assign(BoundMaterial, {
    origamixLayout: manifest.layout,
    origamixRuntime: {
      context: manifest.context,
      defaultProps: manifest.defaultProps,
      initialState: (props: Record<string, unknown>) => initialState(manifest.type, props),
      eventPayload: (event: string, args: unknown[], props: Record<string, unknown>) =>
        eventPayload(manifest.type, event, args, props),
    },
  });
};
