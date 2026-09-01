import React from 'react';
import { Typography } from 'antd';

export interface IProps {
  text?: string;
  type?: 'text' | 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  copyable?: boolean;
  editable?: boolean;
  underline?: boolean;
  strong?: boolean;
  italic?: boolean;
  textType?: 'secondary' | 'success' | 'warning' | 'danger';
  ellipsis?: boolean | { rows: number; expandable: boolean; symbol: string };
  code?: boolean;
  mark?: boolean;
  onClick?: () => void;
}

const TitleLevel: Record<string, 1 | 2 | 3 | 4 | 5> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
};

export const Text = (props: IProps) => {
  const {
    text,
    type,
    copyable,
    code,
    mark,
    editable,
    underline,
    ellipsis,
    textType,
    strong,
    italic,
    onClick,
  } = props;

  const _props = {
    copyable: copyable,
    editable: editable,
    code: code,
    mark: mark,
    underline: underline,
    ellipsis: ellipsis,
    type: textType,
    strong: strong,
    italic: italic,
    onClick: onClick,
  };

  if (type === 'paragraph') {
    return <Typography.Paragraph {..._props}>{text}</Typography.Paragraph>;
  } else if (['h1', 'h2', 'h3', 'h4', 'h5'].includes(type!)) {
    return (
      <Typography.Title level={TitleLevel[type!]} {..._props}>
        {text}
      </Typography.Title>
    );
  } else {
    return <Typography.Text {..._props}>{text}</Typography.Text>;
  }
};

export default Text;
