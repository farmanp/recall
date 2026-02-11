import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckpointPanel } from './CheckpointPanel';

describe('CheckpointPanel', () => {
  const mockCheckpoints = [
    {
      id: 'cp-1',
      name: 'Initial Setup',
      frameIndex: 0,
      createdAt: '2026-02-10T10:00:00Z',
      fileCount: 5,
    },
    {
      id: 'cp-2',
      name: 'Feature Implemented',
      frameIndex: 10,
      createdAt: '2026-02-10T11:00:00Z',
      fileCount: 12,
      notes: 'Implemented the core logic',
    },
  ];

  const defaultProps = {
    checkpoints: mockCheckpoints,
    currentFrameIndex: 5,
    totalFrames: 20,
    onClose: vi.fn(),
    onNavigateToFrame: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onCompare: vi.fn(),
  };

  it('renders checkpoint list', () => {
    render(<CheckpointPanel {...defaultProps} />);
    expect(screen.getByText('Initial Setup')).toBeInTheDocument();
    expect(screen.getByText('Feature Implemented')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('calls onCreate when clicking New button', () => {
    render(<CheckpointPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('New'));
    expect(defaultProps.onCreate).toHaveBeenCalled();
  });

  it('expands checkpoint on click', () => {
    render(<CheckpointPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Feature Implemented'));
    expect(screen.getByText('Implemented the core logic')).toBeInTheDocument();
    expect(screen.getByText('Go to Frame')).toBeInTheDocument();
  });

  it('calls onNavigateToFrame when clicking Go to Frame', () => {
    render(<CheckpointPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Feature Implemented'));
    fireEvent.click(screen.getByText('Go to Frame'));
    expect(defaultProps.onNavigateToFrame).toHaveBeenCalledWith(10);
  });

  it('calls onDelete when clicking Delete', () => {
    render(<CheckpointPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Feature Implemented'));
    fireEvent.click(screen.getByText('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('cp-2');
  });

  it('handles empty state', () => {
    render(<CheckpointPanel {...defaultProps} checkpoints={[]} />);
    expect(screen.getByText('No checkpoints yet')).toBeInTheDocument();
    expect(screen.getByText('Create First Checkpoint')).toBeInTheDocument();
  });

  it('enters compare mode and selects checkpoints', () => {
    render(<CheckpointPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Compare Mode'));

    expect(screen.getByText('Select 2 checkpoints to compare (0/2 selected)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Initial Setup'));
    expect(screen.getByText('Select 2 checkpoints to compare (1/2 selected)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Feature Implemented'));
    expect(screen.getByText('Select 2 checkpoints to compare (2/2 selected)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Compare Selected'));
    expect(defaultProps.onCompare).toHaveBeenCalledWith('cp-1', 'cp-2');
  });
});
