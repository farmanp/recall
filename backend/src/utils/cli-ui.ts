import chalk from 'chalk';

/**
 * CLI UI utilities for professional, memorable server startup display.
 * Uses chalk for terminal colors with automatic TTY detection.
 */

const LOGO = `
   ██████╗ ███████╗ ██████╗ █████╗ ██╗     ██╗
   ██╔══██╗██╔════╝██╔════╝██╔══██╗██║     ██║
   ██████╔╝█████╗  ██║     ███████║██║     ██║
   ██╔══██╗██╔══╝  ██║     ██╔══██║██║     ██║
   ██║  ██║███████╗╚██████╗██║  ██║███████╗███████╗
   ╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝`;

const BOX_WIDTH = 60;

/**
 * Print the ASCII art banner with version number in a box.
 */
export function printBanner(version: string): void {
  const topBorder = '  ╭' + '─'.repeat(BOX_WIDTH) + '╮';
  const bottomBorder = '  ╰' + '─'.repeat(BOX_WIDTH) + '╯';
  const emptyLine = '  │' + ' '.repeat(BOX_WIDTH) + '│';

  console.log('');
  console.log(chalk.cyan(topBorder));
  console.log(chalk.cyan(emptyLine));

  // Print logo lines
  const logoLines = LOGO.split('\n').filter((line) => line.length > 0);
  for (const line of logoLines) {
    const paddedLine = line.padEnd(BOX_WIDTH);
    console.log(chalk.cyan('  │') + chalk.cyan.bold(paddedLine) + chalk.cyan('│'));
  }

  // Version line (right-aligned)
  const versionText = `v${version}`;
  const versionPadding = BOX_WIDTH - versionText.length;
  const versionLine = ' '.repeat(versionPadding) + chalk.dim(versionText);
  console.log(chalk.cyan('  │') + versionLine + chalk.cyan('│'));

  console.log(chalk.cyan(emptyLine));
  console.log(chalk.cyan(bottomBorder));
  console.log('');
}

export interface StatusItem {
  label: string;
  value: string;
  ok: boolean;
}

/**
 * Print status items with colored checkmarks or warning signs.
 */
export function printStatus(items: StatusItem[]): void {
  for (const item of items) {
    const icon = item.ok ? chalk.green('✓') : chalk.yellow('⚠');
    const label = chalk.white(item.label.padEnd(24));
    const value = item.ok ? chalk.cyan(item.value) : chalk.dim(item.value);
    console.log(`  ${icon} ${label}${value}`);
  }
  console.log('');
}

/**
 * Print a horizontal divider line.
 */
export function printDivider(): void {
  console.log(chalk.dim('  ' + '─'.repeat(BOX_WIDTH + 2)));
}

/**
 * Print shutdown hint message.
 */
export function printShutdownHint(): void {
  console.log(
    chalk.dim('  Press Ctrl+C or run ') + chalk.white("'recall stop'") + chalk.dim(' to shutdown')
  );
  printDivider();
  console.log('');
}

/**
 * Print a tip/hint message.
 */
export function printTip(message: string, command?: string): void {
  console.log(chalk.dim('  💡 ' + message));
  if (command) {
    console.log(chalk.dim('     ') + chalk.white(command));
  }
}

/**
 * Print new auth token notification.
 */
export function printNewAuthToken(token: string, filePath: string): void {
  console.log('');
  console.log(
    chalk.yellow('  🔑 Authentication Token') + chalk.dim(' (save this - shown only once):')
  );
  console.log('     ' + chalk.white.bold(token));
  console.log(chalk.dim('     Stored at: ' + filePath));
  console.log('');
}

/**
 * Print shutdown message.
 */
export function printShutdownMessage(signal: string): void {
  console.log('');
  console.log(chalk.yellow(`  ⏹️  ${signal} received, shutting down gracefully...`));
}

/**
 * Print a completed shutdown task.
 */
export function printShutdownComplete(message: string): void {
  console.log(chalk.green('  ✓ ') + chalk.dim(message));
}

/**
 * Print an error message.
 */
export function printError(message: string, error?: unknown): void {
  console.error(chalk.red('  ✗ ') + chalk.white(message));
  if (error) {
    console.error(chalk.dim('    ' + String(error)));
  }
}

/**
 * Print a warning message.
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow('  ⚠ ') + chalk.dim(message));
}

/**
 * Print startup progress message.
 */
export function printProgress(message: string): void {
  console.log(chalk.dim('  → ' + message));
}
