import { Col, Row } from 'antd';
import { Children, type ReactNode } from 'react';
import type { gridColumnCounts } from './grid-layout-config';

export type GridColumns = (typeof gridColumnCounts)[number];

interface MaterialGridProps {
  columns: GridColumns;
  children?: ReactNode;
  placeholder?: ReactNode;
}

export const MaterialGrid = ({ columns, children, placeholder }: MaterialGridProps) => (
  <Row gutter={[16, 16]} style={{ flex: '1 1 100%' }}>
    <style href='origamix-antd-material-grid' precedence='default'>
      {'[data-origamix-grid-cell]:empty { display: none; }'}
    </style>
    {Children.count(children) ? (
      Children.map(children, (child) =>
        child == null ? null : (
          <Col span={24 / Number(columns)} data-origamix-grid-cell=''>
            {child}
          </Col>
        ),
      )
    ) : (
      <Col span={24}>{placeholder}</Col>
    )}
  </Row>
);
