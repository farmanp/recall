import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryCard } from './SummaryCard';

describe('SummaryCard', () => {
  const mockSummary = {
    summaryText: 'This session was about fixing bugs in the export feature.',
    keyDecisions: ['Used Markdown for text exports', 'Added HTML support'],
    filesChanged: {
      created: ['newFile.ts'],
      modified: ['existingFile.ts'],
      deleted: [],
    },
    toolsUsed: {
      read: 5,
      write: 2,
    },
    successIndicators: ['Tests passed'],
    errorCount: 0,
    generatedAt: '2026-02-10T12:00:00Z',
  };

  const defaultProps = {
    summary: mockSummary as any,
    onRegenerate: vi.fn(),
  };

  it('renders summary content when provided', () => {
    render(<SummaryCard {...defaultProps} />);
    expect(
      screen.getByText('This session was about fixing bugs in the export feature.')
    ).toBeInTheDocument();
    expect(screen.getByText('Key Decisions (2)')).toBeInTheDocument();
  });

  it('toggles sections', () => {
    render(<SummaryCard {...defaultProps} />);

    // Summary is expanded by default
    expect(
      screen.getByText('This session was about fixing bugs in the export feature.')
    ).toBeInTheDocument();

    // Toggle Summary section
    fireEvent.click(screen.getByText('Summary'));
    expect(
      screen.queryByText('This session was about fixing bugs in the export feature.')
    ).not.toBeInTheDocument();

    // Expand Files Changed section
    fireEvent.click(screen.getByText('Files Changed'));
    expect(screen.getByText('newFile.ts')).toBeInTheDocument();
    expect(screen.getByText('existingFile.ts')).toBeInTheDocument();
  });

  it('calls onRegenerate when clicking Regenerate button', () => {
    render(<SummaryCard {...defaultProps} />);
    fireEvent.click(screen.getByText('Regenerate'));
    expect(defaultProps.onRegenerate).toHaveBeenCalled();
  });

  it('renders loading state', () => {
    render(<SummaryCard {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Generating summary...')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<SummaryCard {...defaultProps} summary={null} />);
    expect(screen.getByText('No summary available')).toBeInTheDocument();
    expect(screen.getByText('Generate Summary')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<SummaryCard {...defaultProps} summary={null} error="Failed to generate" />);
    expect(screen.getByText('Failed to generate')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});
