import { describe, it, expect, beforeEach } from 'vitest';
import { SecretRedactor } from '../../services/secret-redactor';

describe('SecretRedactor', () => {
  beforeEach(() => {
    // Reset stats by running empty redaction
    SecretRedactor.redact('');
  });

  describe('redact', () => {
    describe('Connection strings', () => {
      it('redacts MongoDB connection strings', () => {
        const content = 'MONGO_URI=mongodb://user:pass@localhost:27017/db';
        const result = SecretRedactor.redact(content);
        expect(result).toBe('MONGO_URI=[REDACTED:CONNECTION_STRING]');
      });
    });

    describe('Edge cases', () => {
      it('handles empty string', () => {
        expect(SecretRedactor.redact('')).toBe('');
      });

      it('does not modify content without secrets', () => {
        const content = 'This is just regular text with no secrets.';
        expect(SecretRedactor.redact(content)).toBe(content);
      });
    });
  });

  describe('containsSecrets', () => {
    it('returns false when content has no secrets', () => {
      expect(SecretRedactor.containsSecrets('Just regular text')).toBe(false);
    });
  });
});
