import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareModal } from './ShareModal';
import * as transcriptClient from '../../api/transcriptClient';

vi.mock('../../api/transcriptClient', () => ({
  createShareLink: vi.fn(),
}));

describe('ShareModal', () => {
  const defaultProps = {
    isOpen: true,
    sessionId: 'session-123',
    sessionName: 'demo-session',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders when open', () => {
    render(<ShareModal {...defaultProps} />);
    expect(screen.getByText('Share Session')).toBeInTheDocument();
    expect(screen.getByText('Enable secret redaction')).toBeInTheDocument();
  });

  it('closes on backdrop click', () => {
    render(<ShareModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('share-modal-backdrop'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('toggles options', () => {
    render(<ShareModal {...defaultProps} />);

    const redactionCheckbox = screen.getByLabelText('Enable secret redaction') as HTMLInputElement;

    expect(redactionCheckbox.checked).toBe(true);

    fireEvent.click(redactionCheckbox);

    expect(redactionCheckbox.checked).toBe(false);
  });

  it('copies URL to clipboard after share link creation', async () => {
    // Use real timers for async test
    vi.useRealTimers();

    vi.mocked(transcriptClient.createShareLink).mockResolvedValueOnce({
      shareId: 'abc123',
      url: 'http://localhost:3001/shared/abc123',
      expiresAt: null,
    });

    render(<ShareModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Create Share Link'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://localhost:3001/shared/abc123')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Copy link'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3001/shared/abc123'
      );
    });

    expect(screen.getByText('Link copied')).toBeInTheDocument();

    // Restore fake timers for cleanup
    vi.useFakeTimers();
  });

  it('closes on Escape key', () => {
    render(<ShareModal {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
