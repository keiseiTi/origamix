export interface PageNavigationMetadata {
  pages: readonly { pageId: string; name: string; path?: string }[];
}
export interface ProjectNavigationInfo extends PageNavigationMetadata {
  runtime: 'origamix' | 'external';
  layoutEnabled: boolean;
}
