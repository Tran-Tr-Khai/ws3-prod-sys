export type WS3DataSource = 'order' | 'machine' | 'worker';

export const ws3DataSourceLabels: Record<WS3DataSource, { vi: string; en: string }> = {
  order: { vi: '7449 · Greige Fabric Out Management', en: '7449 · Greige Fabric Out Management' },
  machine: { vi: '7463 · Weaving Ship List', en: '7463 · Weaving Ship List' },
  worker: { vi: '7462 · Weaving Prod List', en: '7462 · Weaving Prod List' },
};
