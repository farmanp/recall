import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { isViewerModeEnabled, setViewerMode } from '../middleware/viewer-mode';

const router = Router();

/**
 * Schema for viewer mode toggle request
 */
const viewerModeSchema = z.object({
  enabled: z.boolean(),
});

/**
 * GET /api/admin/viewer-mode
 *
 * Get current viewer mode status
 */
router.get('/viewer-mode', (_req: Request, res: Response) => {
  res.json({
    enabled: isViewerModeEnabled(),
  });
});

/**
 * POST /api/admin/viewer-mode
 *
 * Toggle viewer mode on/off
 *
 * @body { enabled: boolean }
 */
router.post('/viewer-mode', validateBody(viewerModeSchema), (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };

  setViewerMode(enabled);

  res.json({
    enabled: isViewerModeEnabled(),
    message: `Viewer mode ${enabled ? 'enabled' : 'disabled'}`,
  });
});

/**
 * GET /api/admin/status
 *
 * Get overall admin status including security features
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    viewerMode: {
      enabled: isViewerModeEnabled(),
    },
    auth: {
      disabled: process.env.RECALL_DISABLE_AUTH === 'true',
    },
  });
});

export default router;
