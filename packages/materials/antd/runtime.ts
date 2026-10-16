export { materialSet } from './material-set';
import { withRuntimeMaterialProps } from '../src/runtime-material';
import { Button } from './button';
import { Input } from './input';
import { Select } from './select';
import { Checkbox } from './checkbox';
import { Radio } from './radio';
import { Switch } from './switch';
import { Form } from './form';
import { Table } from './table';
import { Tabs } from './tabs';
import { Modal } from './modal';
import { Drawer } from './drawer';
import { Upload } from './upload';
import { DatePicker } from './date-picker';
import { TimePicker } from './time-picker';
import { Tree } from './tree';
import { TreeSelect } from './tree-select';
import { Cascader } from './cascader';
import { Number } from './number';
import { BasicPage } from './basic-page';
import { Container } from './container';
import { Text } from './text';
import { Textarea } from './textarea';
import { DatePickerRange } from './date-picker-range';
import { Slider } from './slider';

export const materialComponents = {
  button: withRuntimeMaterialProps(Button),
  input: withRuntimeMaterialProps(Input),
  select: withRuntimeMaterialProps(Select),
  checkbox: withRuntimeMaterialProps(Checkbox),
  radio: withRuntimeMaterialProps(Radio),
  switch: withRuntimeMaterialProps(Switch),
  textarea: withRuntimeMaterialProps(Textarea),
  form: withRuntimeMaterialProps(Form),
  table: withRuntimeMaterialProps(Table),
  tabs: withRuntimeMaterialProps(Tabs),
  modal: withRuntimeMaterialProps(Modal),
  drawer: withRuntimeMaterialProps(Drawer),
  upload: withRuntimeMaterialProps(Upload),
  datePicker: withRuntimeMaterialProps(DatePicker),
  datePickerRange: withRuntimeMaterialProps(DatePickerRange),
  timePicker: withRuntimeMaterialProps(TimePicker),
  tree: withRuntimeMaterialProps(Tree),
  treeSelect: withRuntimeMaterialProps(TreeSelect),
  cascader: withRuntimeMaterialProps(Cascader),
  number: withRuntimeMaterialProps(Number),
  basicPage: withRuntimeMaterialProps(BasicPage),
  container: withRuntimeMaterialProps(Container),
  text: withRuntimeMaterialProps(Text),
  slider: withRuntimeMaterialProps(Slider),
};

export default materialComponents;
