import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: 'doc',
      id: 'api/recall-api',
    },
    {
      type: 'category',
      label: 'Health',
      items: [
        {
          type: 'doc',
          id: 'api/health-check',
          label: 'Health check',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/list-agents',
          label: 'List agents',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/get-overview-stats',
          label: 'Get overview stats',
          className: 'api-method get',
        },
      ],
    },
    {
      type: 'category',
      label: 'Sessions',
      items: [
        {
          type: 'doc',
          id: 'api/list-sessions',
          label: 'List sessions',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/get-cwd-filter-status',
          label: 'Get CWD filter status',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/get-session-details',
          label: 'Get session details',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/get-session-frames',
          label: 'Get session frames',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/refresh-session-cache',
          label: 'Refresh session cache',
          className: 'api-method post',
        },
      ],
    },
    {
      type: 'category',
      label: 'Search',
      items: [
        {
          type: 'doc',
          id: 'api/search-sessions',
          label: 'Search sessions',
          className: 'api-method get',
        },
      ],
    },
    {
      type: 'category',
      label: 'Checkpoints',
      items: [
        {
          type: 'doc',
          id: 'api/list-session-checkpoints',
          label: 'List session checkpoints',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/create-checkpoint',
          label: 'Create checkpoint',
          className: 'api-method post',
        },
        {
          type: 'doc',
          id: 'api/get-checkpoint',
          label: 'Get checkpoint',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/update-checkpoint',
          label: 'Update checkpoint',
          className: 'api-method patch',
        },
        {
          type: 'doc',
          id: 'api/delete-checkpoint',
          label: 'Delete checkpoint',
          className: 'api-method delete',
        },
        {
          type: 'doc',
          id: 'api/get-checkpoint-with-files',
          label: 'Get checkpoint with files',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/compare-checkpoints',
          label: 'Compare checkpoints',
          className: 'api-method get',
        },
      ],
    },
    {
      type: 'category',
      label: 'Rewind',
      items: [
        {
          type: 'doc',
          id: 'api/preview-rewind',
          label: 'Preview rewind',
          className: 'api-method post',
        },
        {
          type: 'doc',
          id: 'api/execute-rewind',
          label: 'Execute rewind',
          className: 'api-method post',
        },
        {
          type: 'doc',
          id: 'api/undo-rewind',
          label: 'Undo rewind',
          className: 'api-method post',
        },
        {
          type: 'doc',
          id: 'api/get-undo-info',
          label: 'Get undo info',
          className: 'api-method get',
        },
      ],
    },
    {
      type: 'category',
      label: 'Shares',
      items: [
        {
          type: 'doc',
          id: 'api/create-share-link',
          label: 'Create share link',
          className: 'api-method post',
        },
        {
          type: 'doc',
          id: 'api/get-shared-session',
          label: 'Get shared session',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/delete-share-link',
          label: 'Delete share link',
          className: 'api-method delete',
        },
      ],
    },
    {
      type: 'category',
      label: 'Summaries',
      items: [
        {
          type: 'doc',
          id: 'api/get-session-summary',
          label: 'Get session summary',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/regenerate-summary',
          label: 'Regenerate summary',
          className: 'api-method post',
        },
        {
          type: 'doc',
          id: 'api/batch-generate-summaries',
          label: 'Batch generate summaries',
          className: 'api-method post',
        },
      ],
    },
    {
      type: 'category',
      label: 'Git',
      items: [
        {
          type: 'doc',
          id: 'api/get-git-context',
          label: 'Get git context',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/list-branches',
          label: 'List branches',
          className: 'api-method get',
        },
      ],
    },
    {
      type: 'category',
      label: 'Admin',
      items: [
        {
          type: 'doc',
          id: 'api/get-viewer-mode-status',
          label: 'Get viewer mode status',
          className: 'api-method get',
        },
        {
          type: 'doc',
          id: 'api/toggle-viewer-mode',
          label: 'Toggle viewer mode',
          className: 'api-method post',
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
