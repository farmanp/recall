import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';
import apiSidebar from './docs/api/sidebar';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'getting-started',
    'configuration',
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/session-replay',
        'features/multi-agent-support',
        'features/checkpoints',
        'features/sharing',
        'features/summaries',
        'features/rewind',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      items: ['development/architecture', 'development/adding-agents'],
    },
    'keyboard-shortcuts',
  ],
  apiSidebar: apiSidebar,
};

export default sidebars;
