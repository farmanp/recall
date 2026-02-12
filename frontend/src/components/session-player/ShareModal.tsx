import React, { useEffect, useState } from 'react';
import { X, Copy, Check, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { createShareLink, type ShareLinkOptions } from '../../api/transcriptClient';

interface ShareModalProps {
  isOpen: boolean;
  sessionId: string;
  sessionName: string;
  onClose: () => void;
}

const DEFAULT_OPTIONS: ShareLinkOptions = {
  enableRedaction: true,
  expiresIn: '24h',
};

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  sessionId,
  sessionName,
  onClose,
}) => {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [options, setOptions] = useState<ShareLinkOptions>(DEFAULT_OPTIONS);

  useEffect(() => {
    if (!isOpen) {
      setShareUrl(null);
      setErrorMessage(null);
      setCopied(false);
      setIsCreating(false);
      setOptions(DEFAULT_OPTIONS);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCreateShareLink = async () => {
    if (!sessionId) {
      setErrorMessage('Session ID is missing.');
      return;
    }

    setErrorMessage(null);
    setIsCreating(true);

    try {
      const data = await createShareLink(sessionId, options);
      setShareUrl(data.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share link';
      setErrorMessage(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!shareUrl || !navigator.clipboard) {
      setErrorMessage('Clipboard is unavailable in this browser context.');
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Failed to copy to clipboard');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        data-testid="share-modal-backdrop"
      />

      <div className="relative w-full max-w-md mx-4 bg-forensic-bg-secondary border border-forensic-border shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-forensic-border">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-accent-cyan" />
            <h2
              id="share-modal-title"
              className="text-sm font-mono font-bold text-forensic-text-primary uppercase tracking-wide"
            >
              Share Session
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-forensic-text-secondary hover:text-forensic-text-primary"
            aria-label="Close share modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm font-mono text-forensic-text-secondary">
            Sharing: <span className="text-forensic-text-primary">{sessionName}</span>
          </div>

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
                  onClick={handleCopyToClipboard}
                  className="px-3 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green hover:bg-accent-green/20"
                  aria-label="Copy link"
                  title="Copy link"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copied && <p className="font-mono text-xs text-accent-green">Link copied</p>}
            </div>
          )}

          {!shareUrl && (
            <div className="space-y-3 p-3 border border-forensic-border bg-forensic-bg-tertiary">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.enableRedaction}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, enableRedaction: e.target.checked }))
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-mono text-forensic-text-secondary">
                  Enable secret redaction
                </span>
              </label>

              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-forensic-text-secondary">Expires:</span>
                <select
                  value={options.expiresIn}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      expiresIn: e.target.value as ShareLinkOptions['expiresIn'],
                    }))
                  }
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

          {errorMessage && (
            <div className="p-2 border border-accent-red/30 bg-accent-red/10">
              <p className="font-mono text-xs text-accent-red">{errorMessage}</p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-accent-amber/10 border border-accent-amber/30">
            <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-accent-amber">
              Anyone with this link can view your session.
              {options.enableRedaction && ' Secrets will be automatically redacted.'}
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-forensic-border">
          {!shareUrl ? (
            <button
              onClick={handleCreateShareLink}
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
