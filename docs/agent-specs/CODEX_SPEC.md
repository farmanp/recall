# Codex Agent Spec: Share UI Components

**Agent:** Codex (5.3)
**Branch:** `feat/share-ui`
**Directory:** `~/Documents/projects/recall-codex/`
**Priority:** MEDIUM - Depends on security work (Claude Code)
**Blocked By:** `feat/live-sharing-security` must merge first

---

## Mission

Build the frontend UI components for sharing sessions: share modal, share link display, and a shareable landing page template. These components will use the security APIs built by Claude Code.

---

## Prerequisites

Wait for Claude Code to complete and merge `feat/live-sharing-security`. You'll need:

- Viewer mode API
- Auth token system
- Secret redaction service

Rebase your branch after that merges:

```bash
git fetch origin
git rebase origin/main
```

---

## Tasks

### Task U.1: Share Modal Component

**File to Create:** `frontend/src/components/session-player/ShareModal.tsx`

**Design:**

```
┌─────────────────────────────────────────┐
│ Share Session                      [X]  │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ http://localhost:3001/shared/abc123 │ │
│ └─────────────────────────────────────┘ │
│                              [Copy Link] │
│                                         │
│ Options:                                │
│ ┌─────────────────────────────────────┐ │
│ │ [✓] Enable secret redaction         │ │
│ │ [ ] Require authentication          │ │
│ │                                     │ │
│ │ Expires: [24 hours ▼]               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ⚠️ Anyone with this link can view       │
│    your session. Secrets will be        │
│    automatically redacted.              │
│                                         │
│              [Create Share Link]        │
└─────────────────────────────────────────┘
```

**Implementation:**

```tsx
// frontend/src/components/session-player/ShareModal.tsx
import React, { useState } from 'react';
import { X, Copy, Check, AlertTriangle, Link as LinkIcon } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  sessionId: string;
  sessionName: string;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  sessionId,
  sessionName,
  onClose,
}) => {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState({
    enableRedaction: true,
    requireAuth: false,
    expiresIn: '24h',
  });

  const createShareLink = async () => {
    setIsCreating(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await response.json();
      setShareUrl(data.url);
    } catch (error) {
      console.error('Failed to create share link:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-forensic-bg-secondary border border-forensic-border w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-forensic-border">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-accent-cyan" />
            <h2 className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide">
              Share Session
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Session Name */}
          <div className="text-sm font-mono text-forensic-text-secondary">
            Sharing: <span className="text-forensic-text-primary">{sessionName}</span>
          </div>

          {/* Share URL (if created) */}
          {shareUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-forensic-bg-primary border border-forensic-border text-forensic-text-primary font-mono text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green/20"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Options */}
          {!shareUrl && (
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.enableRedaction}
                  onChange={(e) => setOptions({ ...options, enableRedaction: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-mono text-forensic-text-secondary">
                  Enable secret redaction
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.requireAuth}
                  onChange={(e) => setOptions({ ...options, requireAuth: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-mono text-forensic-text-secondary">
                  Require authentication
                </span>
              </label>

              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-forensic-text-secondary">Expires:</span>
                <select
                  value={options.expiresIn}
                  onChange={(e) => setOptions({ ...options, expiresIn: e.target.value })}
                  className="px-2 py-1 bg-forensic-bg-primary border border-forensic-border text-forensic-text-primary font-mono text-sm"
                >
                  <option value="1h">1 hour</option>
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-accent-amber/10 border border-accent-amber/30">
            <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-accent-amber">
              Anyone with this link can view your session.
              {options.enableRedaction && ' Secrets will be automatically redacted.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-forensic-border">
          {!shareUrl ? (
            <button
              onClick={createShareLink}
              disabled={isCreating}
              className="w-full px-4 py-2 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan font-mono text-sm hover:bg-accent-cyan/20 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Share Link'}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-forensic-bg-tertiary border border-forensic-border text-forensic-text-secondary font-mono text-sm hover:text-forensic-text-primary"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
```

**Acceptance Criteria:**

- [ ] Modal opens/closes properly
- [ ] Options toggle correctly
- [ ] Copy button copies URL
- [ ] Loading state while creating
- [ ] Warning message displayed
- [ ] Keyboard accessible (Escape closes)

---

### Task U.2: Add Share Button to Session Player

**File to Modify:** `frontend/src/pages/SessionPlayerPage.tsx`

**Changes:**

1. Import ShareModal
2. Add state for `showShareModal`
3. Add Share button to header (icon-only like others)
4. Render ShareModal

```tsx
// Add to imports
import { ShareModal } from '../components/session-player/ShareModal';
import { Share2 } from 'lucide-react';

// Add state
const [showShareModal, setShowShareModal] = useState(false);

// Add button to header toolbar (near other icon buttons)
<button
  onClick={() => setShowShareModal(true)}
  className="inline-flex items-center justify-center w-9 h-9 transition-all border bg-forensic-bg-tertiary border-forensic-border text-forensic-text-secondary hover:text-forensic-text-primary"
  title="Share session"
>
  <Share2 className="w-4 h-4" />
</button>

// Add modal at end of component
<ShareModal
  isOpen={showShareModal}
  sessionId={sessionId || ''}
  sessionName={sessionDetails?.slug || 'Session'}
  onClose={() => setShowShareModal(false)}
/>
```

---

### Task U.3: Shareable Landing Page Template

**File to Create:** `frontend/src/pages/SharedSessionPage.tsx`

**Route:** `/shared/:shareId`

**Design:** A read-only, simplified version of SessionPlayerPage for shared links.

```tsx
// frontend/src/pages/SharedSessionPage.tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, Lock, Clock, AlertTriangle } from 'lucide-react';

export const SharedSessionPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-session', shareId],
    queryFn: async () => {
      const response = await fetch(`/api/shared/${shareId}`);
      if (!response.ok) throw new Error('Share link invalid or expired');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forensic-bg-primary flex items-center justify-center">
        <div className="text-forensic-text-secondary font-mono">Loading shared session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-forensic-bg-primary flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-accent-red mx-auto mb-4" />
          <h1 className="text-xl font-mono text-forensic-text-primary mb-2">Link Invalid</h1>
          <p className="text-forensic-text-secondary font-mono">
            This share link has expired or doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forensic-bg-primary">
      {/* Shared Banner */}
      <div className="bg-accent-cyan/10 border-b border-accent-cyan/30 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-accent-cyan font-mono text-sm">
            <Eye className="w-4 h-4" />
            <span>Viewing shared session (read-only)</span>
          </div>
          <div className="flex items-center gap-4 text-forensic-text-secondary font-mono text-xs">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Secrets redacted
            </span>
            {data.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires {new Date(data.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Session Content - Simplified player */}
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-mono font-bold text-forensic-text-primary mb-2">
          {data.session.slug}
        </h1>
        <div className="text-forensic-text-secondary font-mono text-sm mb-6">
          {data.session.project} · {new Date(data.session.startedAt).toLocaleDateString()}
        </div>

        {/* Frames list */}
        <div className="space-y-4">
          {data.frames.map((frame: any, index: number) => (
            <div
              key={index}
              className={`p-4 border-l-4 ${
                frame.type === 'user_message'
                  ? 'border-accent-cyan bg-accent-cyan/5'
                  : frame.type === 'claude_response'
                    ? 'border-accent-green bg-accent-green/5'
                    : 'border-accent-amber bg-accent-amber/5'
              }`}
            >
              <div className="text-xs font-mono text-forensic-text-muted uppercase mb-2">
                {frame.type.replace('_', ' ')}
              </div>
              <div className="font-mono text-sm text-forensic-text-primary whitespace-pre-wrap">
                {frame.content}
              </div>
            </div>
          ))}
        </div>

        {/* Recall branding */}
        <div className="mt-8 pt-4 border-t border-forensic-border text-center">
          <a
            href="https://github.com/anthropics/recall"
            className="text-forensic-text-muted font-mono text-xs hover:text-accent-cyan"
          >
            Shared via Recall - AI Session Replay
          </a>
        </div>
      </div>
    </div>
  );
};

export default SharedSessionPage;
```

**Add Route:**

```tsx
// In App.tsx or router config
<Route path="/shared/:shareId" element={<SharedSessionPage />} />
```

---

### Task U.4: API Client for Share Endpoints

**File to Modify:** `frontend/src/api/transcriptClient.ts`

Add functions:

```typescript
export async function createShareLink(
  sessionId: string,
  options: { enableRedaction: boolean; requireAuth: boolean; expiresIn: string }
): Promise<{ shareId: string; url: string; expiresAt: string }> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) throw new Error('Failed to create share link');
  return response.json();
}

export async function getSharedSession(shareId: string): Promise<{
  session: any;
  frames: any[];
  expiresAt: string;
}> {
  const response = await fetch(`${API_BASE_URL}/shared/${shareId}`);
  if (!response.ok) throw new Error('Share link invalid or expired');
  return response.json();
}

export async function revokeShareLink(shareId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/shares/${shareId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to revoke share link');
}
```

---

## Testing Strategy

**Unit Tests:**

```tsx
// frontend/src/components/session-player/ShareModal.test.tsx
describe('ShareModal', () => {
  it('renders when open');
  it('closes on backdrop click');
  it('toggles options');
  it('copies URL to clipboard');
});
```

**Visual Testing:**

1. Open modal, verify styling
2. Create link, verify URL display
3. Copy button feedback
4. Visit shared page, verify read-only view

---

## Definition of Done

- [ ] ShareModal component complete
- [ ] Share button added to session player
- [ ] SharedSessionPage for viewing shares
- [ ] API client functions added
- [ ] Route configured
- [ ] Tests passing
- [ ] Styling matches existing design

---

## Commit Messages

```
feat(share): add ShareModal component
feat(share): add share button to session player
feat(share): add SharedSessionPage for viewing shared links
feat(share): add share API client functions
```

---

## Notes for Agent

- **Wait for security merge** - Don't start until Claude Code's branch merges
- **Match existing style** - Use same forensic/monospace design system
- **Test keyboard nav** - Modal should be accessible
- **Handle errors** - Expired links, network errors, etc.
