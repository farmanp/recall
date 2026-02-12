import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../middleware/validation';
import { getTranscriptSessionById } from '../db/transcript-queries';
import { getSessionIndexer } from '../parser/session-indexer';
import {
  createShareLink,
  getSharedSessionData,
  revokeShareLink,
  type ShareExpiry,
} from '../services/share-links';

const router = Router();

const shareParamsSchema = z.object({
  id: z.string().min(1),
});

const shareBodySchema = z.object({
  enableRedaction: z.boolean().default(true),
  expiresIn: z.enum(['1h', '24h', '7d', 'never']).default('24h'),
});

const sharedParamsSchema = z.object({
  shareId: z.string().min(1),
});

function extractShareToken(req: Request): string {
  const headerToken = req.get('x-share-token');
  if (headerToken) {
    return headerToken.trim();
  }

  const authHeader = req.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return typeof req.query.token === 'string' ? req.query.token : '';
}

router.post(
  '/sessions/:id/share',
  validateParams(shareParamsSchema),
  validateBody(shareBodySchema),
  async (req: Request, res: Response) => {
    const { id: sessionId } = res.locals.validatedParams as { id: string };
    const body = req.body as {
      enableRedaction: boolean;
      expiresIn: ShareExpiry;
    };

    // Check DB first, then filesystem
    const dbSession = getTranscriptSessionById(sessionId);
    if (!dbSession) {
      // Fallback to filesystem
      const indexer = getSessionIndexer();
      const fsSession = await indexer.getSessionMetadata(sessionId);
      if (!fsSession) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      // Session exists in filesystem, proceed with share
    }

    const allowUnredacted = process.env.RECALL_ALLOW_UNREDACTED_SHARES === 'true';
    const enableRedaction = allowUnredacted ? body.enableRedaction : true;

    const { shareId, token, expiresAt } = createShareLink(sessionId, {
      enableRedaction,
      expiresIn: body.expiresIn,
    });

    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({
      shareId,
      url: `${origin}/shared/${shareId}#token=${encodeURIComponent(token)}`,
      expiresAt,
      redactionEnabled: enableRedaction,
    });
  }
);

router.get(
  '/shared/:shareId',
  validateParams(sharedParamsSchema),
  async (req: Request, res: Response) => {
    const { shareId } = res.locals.validatedParams as { shareId: string };
    const token = extractShareToken(req);
    if (!token) {
      res.status(401).json({ error: 'Share token required' });
      return;
    }

    const data = await getSharedSessionData(shareId, token);
    if (!data) {
      res.status(404).json({ error: 'Share link invalid or expired' });
      return;
    }

    res.json(data);
  }
);

router.delete(
  '/shares/:shareId',
  validateParams(sharedParamsSchema),
  (_req: Request, res: Response) => {
    const { shareId } = res.locals.validatedParams as { shareId: string };
    const revoked = revokeShareLink(shareId);
    if (!revoked) {
      res.status(404).json({ error: 'Share link not found' });
      return;
    }
    res.status(204).end();
  }
);

export default router;
