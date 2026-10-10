import { Content } from '@rspress/core/runtime';
import {
  Layout as OriginalLayout,
  type LayoutProps,
} from '@rspress/core/theme-original';
import './index.css';

// Rspress requires forwarding the original theme exports for its theme entry.
// eslint-disable-next-line react-refresh/only-export-components
export * from '@rspress/core/theme-original';

export const Layout = (props: LayoutProps): React.JSX.Element => (
  <OriginalLayout
    {...props}
    afterFeatures={
      <div className="rp-doc origamix-home-content">
        <Content />
      </div>
    }
  />
);
