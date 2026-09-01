// import BasicPage from './basic-page/material-config';
import Button from './button/material-config';
import Input from './input/material-config';
import Select from './select/material-config';
import Checkbox from './checkbox/material-config';
import Radio from './radio/material-config';
import Switch from './switch/material-config';
import Form from './form/material-config';
import Table from './table/material-config';
// import Tabs from './tabs/material-config';
import Modal from './modal/material-config';
import Drawer from './drawer/material-config';
import Upload from './upload/material-config';
import DatePicker from './date-picker/material-config';
import TimePicker from './time-picker/material-config';
import Tree from './tree/material-config';
import TreeSelect from './tree-select/material-config';
import Cascader from './cascader/material-config';
import Number from './number/material-config';
import Container from './container/material-config';
import Text from './text/material-config';
import Textarea from './textarea/material-config';
import DatePickerRange from './date-picker-range/material-config';
import Slider from './slider/material-config';

export const materialGroups = [
  {
    title: '布局容器',
    children: [Container, Form, Modal, Drawer],
  },
  {
    title: '原子物料',
    children: [
      Input,
      Number,
      Checkbox,
      Radio,
      Select,
      Textarea,
      DatePicker,
      DatePickerRange,
      TimePicker,
      Switch,
      TreeSelect,
      Cascader,
      Slider,
      Upload,
    ],
  },
  {
    title: '展示物料',
    children: [Button, Text, Table, Tree],
  },
];

export default materialGroups;
