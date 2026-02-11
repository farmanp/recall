import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportModal } from './ExportModal';
import * as exportUtils from '../../lib/exportSession';

// Mock the export utilities
vi.mock('../../lib/exportSession', () => ({
  sessionToMarkdown: vi.fn(() => 'mock markdown'),
  sessionToHTML: vi.fn(() => 'mock html'),
  frameToMarkdown: vi.fn(() => 'mock frame markdown'),
  frameToHTML: vi.fn(() => 'mock frame html'),
  downloadFile: vi.fn(),
}));

describe('ExportModal', () => {
  const mockFrame = {
    id: 'frame-1',
    type: 'user_message',
    timestamp: 1644480000000,
    context: { cwd: '/test' },
    userMessage: { text: 'Hello' },
  };

  const mockFrames = [mockFrame];

  const mockSessionDetails = {
    slug: 'test-session',
    project: 'test-project',
  };

  const defaultProps = {
    currentFrame: mockFrame as any,
    currentFrameIndex: 0,
    sessionDetails: mockSessionDetails as any,
    frames: mockFrames as any,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<ExportModal {...defaultProps} />);
    expect(screen.getByText('Export Session')).toBeInTheDocument();
    expect(screen.getByText('Current Frame')).toBeInTheDocument();
    expect(screen.getByText('Full Session')).toBeInTheDocument();
  });

  it('calls onClose when clicking backdrop', () => {
    render(<ExportModal {...defaultProps} />);
    // Find the backdrop by its class, avoiding the slash in selector if possible
    const divs = document.querySelectorAll('div');
    const backdrop = Array.from(divs).find((d) => d.className.includes('bg-black/50'));
    if (backdrop) fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking Cancel', () => {
    render(<ExportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('exports current frame as markdown by default', () => {
    render(<ExportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Export Markdown'));

    expect(exportUtils.frameToMarkdown).toHaveBeenCalledWith(mockFrame, mockSessionDetails);
    expect(exportUtils.downloadFile).toHaveBeenCalledWith(
      'test-session_frame-1.md',
      'mock frame markdown'
    );
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('exports full session as HTML when selected', () => {
    render(<ExportModal {...defaultProps} />);

    // Select Full Session - click the radio button or the text
    fireEvent.click(screen.getByText('Full Session'));

    // Select HTML
    fireEvent.click(screen.getByText('HTML'));

    fireEvent.click(screen.getByText('Export HTML'));

    expect(exportUtils.sessionToHTML).toHaveBeenCalled();
    expect(exportUtils.downloadFile).toHaveBeenCalledWith('test-session.html', 'mock html');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
