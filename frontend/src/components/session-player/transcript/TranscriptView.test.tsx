import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlaybackFrame } from '../../../types/transcript';
import { TranscriptFrame } from './TranscriptFrame';
import { ToolCard } from './ToolCard';
import { ThinkingBlock } from './ThinkingBlock';

// Test fixtures
const mockUserFrame: PlaybackFrame = {
  id: 'frame-1',
  type: 'user_message',
  timestamp: Date.now(),
  agent: 'claude',
  userMessage: { text: 'Hello, can you help me?' },
  context: { cwd: '/project' },
};

const mockResponseFrame: PlaybackFrame = {
  id: 'frame-2',
  type: 'claude_response',
  timestamp: Date.now(),
  agent: 'claude',
  claudeResponse: { text: 'Of course! How can I help?' },
  context: { cwd: '/project' },
};

const mockThinkingFrame: PlaybackFrame = {
  id: 'frame-3',
  type: 'claude_thinking',
  timestamp: Date.now(),
  agent: 'claude',
  thinking: {
    text: 'The user wants help with something.\nLet me think about how to respond.\nI should be helpful and clear.\nThis is line four.\nAnd line five.',
  },
  context: { cwd: '/project' },
};

const mockToolFrame: PlaybackFrame = {
  id: 'frame-4',
  type: 'tool_execution',
  timestamp: Date.now(),
  agent: 'claude',
  toolExecution: {
    tool: 'Read',
    input: { file_path: '/project/src/index.ts' },
    output: { content: 'console.log("hello");', isError: false },
  },
  context: { cwd: '/project' },
};

const mockBashFrame: PlaybackFrame = {
  id: 'frame-5',
  type: 'tool_execution',
  timestamp: Date.now(),
  agent: 'claude',
  toolExecution: {
    tool: 'Bash',
    input: { command: 'npm test' },
    output: { content: 'All tests passed!', isError: false },
  },
  context: { cwd: '/project' },
};

const mockErrorToolFrame: PlaybackFrame = {
  id: 'frame-6',
  type: 'tool_execution',
  timestamp: Date.now(),
  agent: 'claude',
  toolExecution: {
    tool: 'Read',
    input: { file_path: '/nonexistent/file.ts' },
    output: { content: 'File not found', isError: true },
  },
  context: { cwd: '/project' },
};

const mockEditFrame: PlaybackFrame = {
  id: 'frame-7',
  type: 'tool_execution',
  timestamp: Date.now(),
  agent: 'claude',
  toolExecution: {
    tool: 'Edit',
    input: { file_path: '/project/src/index.ts', old_string: 'hello', new_string: 'world' },
    output: { content: 'File edited successfully', isError: false },
    fileDiff: {
      filePath: '/project/src/index.ts',
      oldContent: 'console.log("hello");',
      newContent: 'console.log("world");',
      language: 'typescript',
    },
  },
  context: { cwd: '/project' },
};

describe('TranscriptFrame', () => {
  const defaultProps = {
    frameIndex: 0,
    isCurrent: false,
    isExpanded: false,
    onToggleExpand: vi.fn(),
    onNavigateToFrame: vi.fn(),
    searchQuery: '',
  };

  it('renders user message with correct styling', () => {
    render(<TranscriptFrame frame={mockUserFrame} {...defaultProps} />);
    expect(screen.getByText('Hello, can you help me?')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders claude response with correct styling', () => {
    render(<TranscriptFrame frame={mockResponseFrame} {...defaultProps} />);
    expect(screen.getByText('Of course! How can I help?')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
  });

  it('renders thinking block', () => {
    render(<TranscriptFrame frame={mockThinkingFrame} {...defaultProps} />);
    expect(screen.getByText(/Claude thinking/)).toBeInTheDocument();
  });

  it('renders tool execution card', () => {
    render(<TranscriptFrame frame={mockToolFrame} {...defaultProps} />);
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('applies current frame styling when isCurrent is true', () => {
    const { container } = render(
      <TranscriptFrame frame={mockUserFrame} {...defaultProps} isCurrent={true} />
    );
    expect(container.querySelector('.border-l-accent-green')).toBeInTheDocument();
  });

  it('highlights search matches in user message', () => {
    render(<TranscriptFrame frame={mockUserFrame} {...defaultProps} searchQuery="help" />);
    expect(screen.getByText('help')).toHaveClass('bg-yellow-400');
  });
});

describe('ToolCard', () => {
  const defaultProps = {
    timestamp: '10:30:00 AM',
    frameIndex: 0,
    isExpanded: false,
    onToggleExpand: vi.fn(),
    onNavigateToFrame: vi.fn(),
    searchQuery: '',
  };

  it('renders collapsed tool card with tool name', () => {
    render(<ToolCard toolExecution={mockToolFrame.toolExecution!} {...defaultProps} />);
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('shows file path when available', () => {
    render(<ToolCard toolExecution={mockToolFrame.toolExecution!} {...defaultProps} />);
    expect(screen.getByText('/project/src/index.ts')).toBeInTheDocument();
  });

  it('shows error status for failed tool execution', () => {
    render(<ToolCard toolExecution={mockErrorToolFrame.toolExecution!} {...defaultProps} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('expands to show input and output when clicked', async () => {
    const onToggle = vi.fn();
    render(
      <ToolCard
        toolExecution={mockToolFrame.toolExecution!}
        {...defaultProps}
        onToggleExpand={onToggle}
      />
    );

    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows input parameters when expanded', () => {
    render(
      <ToolCard toolExecution={mockToolFrame.toolExecution!} {...defaultProps} isExpanded={true} />
    );
    expect(screen.getByText('// Input Parameters')).toBeInTheDocument();
    expect(screen.getByText('// Output')).toBeInTheDocument();
  });

  it('shows command for bash tool', () => {
    render(
      <ToolCard toolExecution={mockBashFrame.toolExecution!} {...defaultProps} isExpanded={true} />
    );
    // Command appears in both header (as file path) and in expanded output
    const commands = screen.getAllByText('npm test');
    expect(commands.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$')).toBeInTheDocument();
  });
});

describe('ThinkingBlock', () => {
  const defaultProps = {
    text: 'Short thinking text',
    timestamp: '10:30:00 AM',
    frameIndex: 0,
    agentName: 'Claude',
    isExpanded: false,
    onToggleExpand: vi.fn(),
    searchQuery: '',
  };

  it('renders thinking block with agent name', () => {
    render(<ThinkingBlock {...defaultProps} />);
    expect(screen.getByText('Claude thinking')).toBeInTheDocument();
  });

  it('shows preview text when collapsed for long content', () => {
    const longText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    render(<ThinkingBlock {...defaultProps} text={longText} />);
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    // Should show expand button for long content
    expect(screen.getByText(/Expand/)).toBeInTheDocument();
  });

  it('shows full content when expanded', () => {
    const longText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    render(<ThinkingBlock {...defaultProps} text={longText} isExpanded={true} />);
    expect(screen.getByText(/Collapse/)).toBeInTheDocument();
    expect(screen.getByText(/Line 5/)).toBeInTheDocument();
  });

  it('does not show expand button for short content', () => {
    render(<ThinkingBlock {...defaultProps} text="Short" />);
    expect(screen.queryByText(/Expand/)).not.toBeInTheDocument();
  });

  it('calls onToggleExpand when expand button is clicked', async () => {
    const onToggle = vi.fn();
    const longText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    render(<ThinkingBlock {...defaultProps} text={longText} onToggleExpand={onToggle} />);

    const expandButton = screen.getByText(/Expand/);
    await userEvent.click(expandButton);
    expect(onToggle).toHaveBeenCalled();
  });

  it('highlights search matches', () => {
    render(<ThinkingBlock {...defaultProps} text="thinking about code" searchQuery="code" />);
    expect(screen.getByText('code')).toHaveClass('bg-yellow-400');
  });
});
