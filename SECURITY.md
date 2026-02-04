# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Recall, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainer (see package.json for contact)
3. Include a detailed description of the vulnerability
4. Provide steps to reproduce if possible

### What to expect

- Acknowledgment of your report within 48 hours
- Regular updates on the progress of addressing the vulnerability
- Credit in the release notes (unless you prefer to remain anonymous)

## Security Considerations

Recall is designed as a **local-only** application:

- All session data remains on your local machine
- No data is transmitted to external servers
- Session files may contain sensitive information (API keys, credentials, etc.)

### Best Practices

- Do not expose the Recall server to the public internet
- Review session files before sharing them
- Keep your Recall installation updated to the latest version
