import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('renders error text', () => {
    render(<ErrorMessage error="Something failed" />);
    expect(screen.getByText('Something failed')).toBeInTheDocument();
  });

  it('invokes retry callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorMessage error="Oops" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /retry connection/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
