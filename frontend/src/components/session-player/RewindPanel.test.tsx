import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RewindPanel } from './RewindPanel';

describe('RewindPanel', () => {
  const defaultProps = {
    sessionId: 'session-1',
    targetFrameIndex: 5,
    currentFrameIndex: 10,
    plan: null,
    onClose: vi.fn(),
    onPreview: vi.fn(),
    onExecute: vi.fn(),
  };

  it('renders "Ready to preview rewind" state initially', () => {
    render(<RewindPanel {...defaultProps} />);
    expect(screen.getByText('Ready to preview rewind')).toBeInTheDocument();
    expect(screen.getByText('Generate Preview')).toBeInTheDocument();
  });

  it('calls onPreview when clicking Generate Preview', () => {
    render(<RewindPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Generate Preview'));
    expect(defaultProps.onPreview).toHaveBeenCalled();
  });

  it('renders loading state', () => {
    render(<RewindPanel {...defaultProps} isLoadingPreview={true} />);
    expect(screen.getByText('Analyzing changes...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<RewindPanel {...defaultProps} previewError="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('renders plan details when plan is provided', () => {
    const mockPlan = {
      files: [
        { path: 'file1.ts', action: 'modify', content: 'new content' },
        { path: 'file2.ts', action: 'create', content: 'fresh content' },
      ],
      conflicts: [],
      warnings: [],
    };
    render(<RewindPanel {...defaultProps} plan={mockPlan as any} />);

    expect(screen.getByText('MODIFY')).toBeInTheDocument();
    expect(screen.getByText('CREATE')).toBeInTheDocument();
    expect(screen.getByText('file1.ts')).toBeInTheDocument();
    expect(screen.getByText('Execute Rewind')).toBeInTheDocument();
  });

  it('calls onExecute with options when clicking Execute Rewind', () => {
    const mockPlan = {
      files: [{ path: 'file1.ts', action: 'modify', content: 'new content' }],
      conflicts: [],
      warnings: [],
    };
    render(<RewindPanel {...defaultProps} plan={mockPlan as any} />);

    fireEvent.click(screen.getByText('Execute Rewind'));
    expect(defaultProps.onExecute).toHaveBeenCalledWith({
      createBackups: true,
      skipConflicts: false,
    });
  });

  it('shows conflicts and disables execute button if conflicts not skipped', () => {
    const mockPlan = {
      files: [{ path: 'file1.ts', action: 'modify', content: 'new content' }],
      conflicts: [{ path: 'file1.ts', reason: 'File changed locally' }],
      warnings: [],
    };
    render(<RewindPanel {...defaultProps} plan={mockPlan as any} />);

    expect(screen.getByText('1 Conflict Detected')).toBeInTheDocument();
    expect(screen.getByText('File changed locally')).toBeInTheDocument();

    const executeBtn = screen.getByText('Execute Rewind').closest('button');
    expect(executeBtn).toBeDisabled();

    // Toggle skip conflicts
    fireEvent.click(screen.getByText('Skip conflicting files'));
    expect(executeBtn).not.toBeDisabled();
  });
});
