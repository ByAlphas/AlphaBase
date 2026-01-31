# Security Policy

## Supported Versions

We release security updates for the following versions of AlphaBase:

| Version | Supported          | Notes |
| ------- | ------------------ | ----- |
| 4.0.0   | :white_check_mark: | Current - Includes proper encryption salt handling |
| 3.1.x   | :x:                | Not supported |
| 3.0.x   | :x:                | Not supported |
| < 3.0   | :x:                | Not supported |

## Reporting a Vulnerability

We take the security of AlphaBase seriously. If you have discovered a security vulnerability, please report it responsibly.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please send a report to the project maintainers via:
- GitHub Security Advisories: https://github.com/ByAlphas/alphabase/security/advisories/new
- Or create a private issue if the above is not available

### What to Include

Your report should include:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)
- Your contact information (optional)

### Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Status Update**: Within 5 business days regarding acceptance/rejection
- **Fix Timeline**: Security fixes are prioritized and typically released within 14 days for critical issues

## Security Best Practices

### For Application Developers

When using AlphaBase in your applications, follow these security guidelines:

#### 1. Encryption

Always use strong encryption for sensitive data:

```javascript
const db = new AlphaBase({
  filePath: './sensitive-data.json',
  password: 'use-a-strong-random-password',
  encryption: 'AES' // Recommended: AES or TripleDES
});
```

**Avoid:**
- Using weak passwords
- Using 'XOR' encryption in production
- Using 'None' or 'Base64' for sensitive data (these are not encryption)

#### 2. Password Management

- Store passwords in environment variables, not in code
- Use strong, randomly generated passwords
- Rotate passwords periodically
- Never commit passwords to version control

```javascript
// Good
const db = new AlphaBase({
  filePath: './data.json',
  password: process.env.DB_PASSWORD,
  encryption: 'AES'
});

// Bad
const db = new AlphaBase({
  filePath: './data.json',
  password: '12345', // Weak password in code
  encryption: 'AES'
});
```

#### 3. HTTP Server Security

When using the HTTP server feature:

```javascript
const AlphaServer = require('alphabase/server');

const server = new AlphaServer({
  port: 3000,
  database: './data.json',
  jwtSecret: process.env.JWT_SECRET, // Use environment variable
  auth: true, // Enable authentication
  allowServerStart: true // Explicit permission required
});
```

**Important:**
- Always enable authentication in production
- Use strong JWT secrets
- Consider using HTTPS reverse proxy (nginx, Apache)
- Implement rate limiting at the application or proxy level

#### 4. JWT Tokens

- Use strong secret keys (minimum 32 characters)
- Set appropriate expiration times
- Store JWT secrets securely (environment variables)
- Implement token refresh mechanisms

```javascript
// Good
const jwtAuth = new JWTAuth(process.env.JWT_SECRET);
const token = jwtAuth.createToken(
  { userId: 123 },
  { expiresIn: '1h' } // Short expiration
);

// Bad
const jwtAuth = new JWTAuth('secret'); // Weak secret
const token = jwtAuth.createToken(
  { userId: 123 },
  { expiresIn: '30d' } // Too long
);
```

#### 5. File Permissions

Ensure database files have appropriate permissions:

```bash
# Linux/macOS
chmod 600 data.json      # Read/write for owner only
chmod 700 data-directory # Execute for owner only on directories

# Check permissions
ls -la data.json
```

#### 6. Audit Logging

Enable audit logging for security monitoring:

```javascript
const db = new AlphaBase({
  filePath: './data.json',
  audit: {
    enabled: true,
    logFile: './logs/audit.log',
    maxFileSize: 10485760, // 10MB
    maxFiles: 5
  }
});
```

Review audit logs regularly for suspicious activity.

### For AlphaBase Developers

If you're contributing to AlphaBase:

1. **Input Validation**: Always validate and sanitize user inputs
2. **Secure Defaults**: Default configurations should be secure
3. **Dependency Security**: Keep dependencies updated and audit them regularly
4. **Code Review**: All security-related code requires review
5. **Testing**: Write security tests for new features

## Known Limitations

### Current Security Considerations

1. **HTTP vs HTTPS**: The built-in server uses HTTP. For production, use HTTPS reverse proxy
2. **File-Based**: Database files must be protected at filesystem level
3. **Single Process**: No built-in protection against concurrent writes from multiple processes
4. **Memory Exposure**: Sensitive data may be visible in memory dumps
5. **No Built-in Rate Limiting**: Implement at application or proxy level

### Not Suitable For

AlphaBase is **not recommended** for:
- Multi-tenant applications without additional isolation
- Storing highly sensitive data without additional encryption layers
- Applications requiring compliance certifications (PCI-DSS, HIPAA, etc.)
- Distributed systems without additional coordination mechanisms

## Security Features

### Implemented Security Features

- **Encryption**: Multiple algorithms (AES, TripleDES, Rabbit)
- **JWT Authentication**: Token-based authentication
- **RSA Encryption**: Asymmetric encryption support
- **Audit Logging**: Operation tracking and logging
- **Data Integrity**: SHA256 checksum verification
- **Input Validation**: Type checking and validation
- **Secure Defaults**: Requires explicit permission for sensitive operations

### Planned Security Enhancements

Future versions may include:
- HTTPS support for built-in server
- Built-in rate limiting
- Token revocation mechanisms
- Key rotation support
- Enhanced encryption options
- Security policy enforcement

## Compliance

AlphaBase is designed with security in mind but has not been audited for specific compliance requirements. If you need compliance certification (HIPAA, PCI-DSS, SOC 2, etc.), please:

1. Conduct your own security audit
2. Implement additional security layers as needed
3. Ensure proper encryption and access controls
4. Maintain audit logs
5. Follow your organization's security policies

## Security Updates

Security updates are announced through:
- GitHub Security Advisories
- Release notes in CHANGELOG.md
- npm package updates

Subscribe to releases on GitHub to stay informed.

## Contact

For security concerns, please contact:
- GitHub Security Advisories: https://github.com/ByAlphas/alphabase/security/advisories
- GitHub Issues (for non-sensitive security improvements)

## Acknowledgments

We thank the security researchers and community members who help keep AlphaBase secure.

---

**Last Updated**: January 30, 2026
**Version**: 4.0.0
