// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarActionMenu } from '../../../src/components/sidebar/action-menu';

afterEach(cleanup);

describe('SidebarActionMenu', () => {
  it('opens the custom menu and runs its actions', () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();

    render(<SidebarActionMenu label='示例页面操作' onRename={onRename} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: '示例页面操作' }));
    expect(screen.getByRole('menu', { name: '示例页面操作' })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: '编辑' }));
    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '示例页面操作' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '删除' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('closes with Escape and restores focus to the trigger', () => {
    render(<SidebarActionMenu label='项目操作' onRename={vi.fn()} onDelete={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: '项目操作' });

    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
