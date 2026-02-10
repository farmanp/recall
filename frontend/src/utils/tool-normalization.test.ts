import { describe, it, expect } from 'vitest';
import {
  normalizeToolCategory,
  isReadTool,
  isWriteTool,
  isEditTool,
  isShellTool,
  getToolsForCategory,
} from './tool-normalization';

describe('tool-normalization', () => {
  describe('normalizeToolCategory', () => {
    describe('Claude Code tools', () => {
      it('should normalize Read to read', () => {
        expect(normalizeToolCategory('Read')).toBe('read');
      });

      it('should normalize Glob to read', () => {
        expect(normalizeToolCategory('Glob')).toBe('read');
      });

      it('should normalize Grep to read', () => {
        expect(normalizeToolCategory('Grep')).toBe('read');
      });

      it('should normalize NotebookRead to read', () => {
        expect(normalizeToolCategory('NotebookRead')).toBe('read');
      });

      it('should normalize Write to write', () => {
        expect(normalizeToolCategory('Write')).toBe('write');
      });

      it('should normalize NotebookEdit to write', () => {
        expect(normalizeToolCategory('NotebookEdit')).toBe('write');
      });

      it('should normalize Edit to edit', () => {
        expect(normalizeToolCategory('Edit')).toBe('edit');
      });

      it('should normalize Bash to shell', () => {
        expect(normalizeToolCategory('Bash')).toBe('shell');
      });
    });

    describe('Gemini CLI tools', () => {
      it('should normalize read_file to read', () => {
        expect(normalizeToolCategory('read_file')).toBe('read');
      });

      it('should normalize glob to read', () => {
        expect(normalizeToolCategory('glob')).toBe('read');
      });

      it('should normalize list_directory to read', () => {
        expect(normalizeToolCategory('list_directory')).toBe('read');
      });

      it('should normalize write_file to write', () => {
        expect(normalizeToolCategory('write_file')).toBe('write');
      });

      it('should normalize create_file to write', () => {
        expect(normalizeToolCategory('create_file')).toBe('write');
      });

      it('should normalize replace to edit', () => {
        expect(normalizeToolCategory('replace')).toBe('edit');
      });

      it('should normalize shell to shell', () => {
        expect(normalizeToolCategory('shell')).toBe('shell');
      });

      it('should normalize run_shell_command to shell', () => {
        expect(normalizeToolCategory('run_shell_command')).toBe('shell');
      });
    });

    describe('Codex CLI tools', () => {
      it('should normalize shell_command to shell', () => {
        expect(normalizeToolCategory('shell_command')).toBe('shell');
      });
    });

    describe('unknown tools', () => {
      it('should return other for unknown tool names', () => {
        expect(normalizeToolCategory('custom_tool')).toBe('other');
        expect(normalizeToolCategory('unknown')).toBe('other');
        expect(normalizeToolCategory('')).toBe('other');
      });
    });
  });

  describe('isReadTool', () => {
    it('should return true for read tools', () => {
      expect(isReadTool('Read')).toBe(true);
      expect(isReadTool('Glob')).toBe(true);
      expect(isReadTool('Grep')).toBe(true);
      expect(isReadTool('read_file')).toBe(true);
      expect(isReadTool('list_directory')).toBe(true);
    });

    it('should return false for non-read tools', () => {
      expect(isReadTool('Write')).toBe(false);
      expect(isReadTool('Edit')).toBe(false);
      expect(isReadTool('Bash')).toBe(false);
      expect(isReadTool('unknown')).toBe(false);
    });
  });

  describe('isWriteTool', () => {
    it('should return true for write tools', () => {
      expect(isWriteTool('Write')).toBe(true);
      expect(isWriteTool('NotebookEdit')).toBe(true);
      expect(isWriteTool('write_file')).toBe(true);
      expect(isWriteTool('create_file')).toBe(true);
    });

    it('should return false for non-write tools', () => {
      expect(isWriteTool('Read')).toBe(false);
      expect(isWriteTool('Edit')).toBe(false);
      expect(isWriteTool('replace')).toBe(false);
    });
  });

  describe('isEditTool', () => {
    it('should return true for edit tools', () => {
      expect(isEditTool('Edit')).toBe(true);
      expect(isEditTool('replace')).toBe(true);
    });

    it('should return false for non-edit tools', () => {
      expect(isEditTool('Read')).toBe(false);
      expect(isEditTool('Write')).toBe(false);
      expect(isEditTool('write_file')).toBe(false);
    });
  });

  describe('isShellTool', () => {
    it('should return true for shell tools', () => {
      expect(isShellTool('Bash')).toBe(true);
      expect(isShellTool('shell')).toBe(true);
      expect(isShellTool('run_shell_command')).toBe(true);
      expect(isShellTool('shell_command')).toBe(true);
    });

    it('should return false for non-shell tools', () => {
      expect(isShellTool('Read')).toBe(false);
      expect(isShellTool('Write')).toBe(false);
      expect(isShellTool('Edit')).toBe(false);
    });
  });

  describe('getToolsForCategory', () => {
    it('should return all read tools', () => {
      const readTools = getToolsForCategory('read');
      expect(readTools).toContain('Read');
      expect(readTools).toContain('Glob');
      expect(readTools).toContain('Grep');
      expect(readTools).toContain('read_file');
      expect(readTools).toContain('list_directory');
    });

    it('should return all write tools', () => {
      const writeTools = getToolsForCategory('write');
      expect(writeTools).toContain('Write');
      expect(writeTools).toContain('NotebookEdit');
      expect(writeTools).toContain('write_file');
      expect(writeTools).toContain('create_file');
    });

    it('should return all edit tools', () => {
      const editTools = getToolsForCategory('edit');
      expect(editTools).toContain('Edit');
      expect(editTools).toContain('replace');
    });

    it('should return all shell tools', () => {
      const shellTools = getToolsForCategory('shell');
      expect(shellTools).toContain('Bash');
      expect(shellTools).toContain('shell');
      expect(shellTools).toContain('run_shell_command');
      expect(shellTools).toContain('shell_command');
    });

    it('should return empty array for other category', () => {
      const otherTools = getToolsForCategory('other');
      expect(otherTools).toHaveLength(0);
    });
  });
});
