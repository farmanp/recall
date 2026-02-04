import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentBadge } from './AgentBadge';

describe('AgentBadge', () => {
  it('renders the correct label for agent type', () => {
    render(<AgentBadge agent="codex" />);
    expect(screen.getByText('Codex')).toBeInTheDocument();
  });

  it('falls back to Unknown when agent is missing', () => {
    render(<AgentBadge />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
