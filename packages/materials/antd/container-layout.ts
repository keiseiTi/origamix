import type { CSSProperties } from 'react';

export interface ContainerLayoutProps {
  layoutMode?: 'normal' | 'absolute';
  display?: 'flow' | 'flex';
  flexDirection?: 'row' | 'column';
  gap?: number;
  flexWrap?: 'nowrap' | 'wrap';
  alignItems?: 'stretch' | 'flex-start' | 'center' | 'flex-end';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
}

export const getContainerStyle = (props: ContainerLayoutProps): CSSProperties =>
  props.layoutMode === 'absolute'
    ? { position: 'relative', minHeight: 200 }
    : props.display === 'flex'
      ? {
          display: 'flex',
          flexDirection: props.flexDirection ?? 'column',
          gap: props.gap,
          flexWrap: props.flexWrap,
          alignItems: props.alignItems,
          justifyContent: props.justifyContent,
        }
      : {};
