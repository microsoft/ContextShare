# Security Guidelines for ContextHub Development

This document outlines security practices and guidelines for developing and maintaining the ContextHub VS Code extension.

## 🔒 Security Principles

### 1. Defense in Depth
- Multiple layers of security controls
- Input validation at all boundaries  
- Principle of least privilege
- Fail securely by default

### 2. Security by Design
- Security considerations integrated from the start
- Threat modeling for new features
- Regular security reviews
- Automated security testing

## 🛡️ Development Security Practices

### Code Security

**Input Validation:**
- Validate all user inputs (file paths, URLs, configuration)
- Sanitize filenames and paths to prevent directory traversal
- Validate remote URLs are HTTPS-only for catalog sources
- Use path normalization functions consistently

**Output Encoding:**
- Sanitize data before display in VS Code UI
- Escape special characters in generated files
- Use parameterized queries if database access is added

**Error Handling:**
- Don't expose internal paths or sensitive info in error messages
- Log security events appropriately
- Handle exceptions gracefully without information disclosure

### File System Security

**Path Traversal Prevention:**
```typescript
// Good: Validate paths are within expected directories
const safePath = path.resolve(baseDir, userInput);
if (!safePath.startsWith(path.resolve(baseDir))) {
  throw new Error('Invalid path');
}

// Bad: Direct user input to file system
fs.readFile(userInput); // Vulnerable to ../../../etc/passwd
```

**Safe File Operations:**
- Always use absolute paths for file operations
- Validate file extensions and MIME types
- Set appropriate file permissions
- Clean up temporary files

### Remote Content Security

**HTTPS-Only Policy:**
- All remote catalog sources must use HTTPS
- Reject HTTP URLs in configuration
- Validate SSL certificates

**Content Validation:**
- Validate JSON structure of remote catalogs
- Sanitize remote content before processing
- Implement size limits for remote content
- Cache with TTL to limit remote requests

## 🔐 Secrets and Credentials Management

### What NOT to Include in Code
- API keys, tokens, passwords
- Database connection strings  
- Private keys or certificates
- Internal URLs or service endpoints
- Personal information

### Secure Configuration
```typescript
// Good: Environment-based configuration
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable required');
}

// Bad: Hardcoded secrets
const apiKey = 'sk-1234567890abcdef'; // Never do this!
```

### Development Secrets
- Use .env files for local development (add to .gitignore)
- Use VS Code settings for non-sensitive configuration
- Document required environment variables in README

## 🚨 Security Testing

### Automated Security Scanning
```bash
# Run security audit
npm run security:audit

# Check for secrets
npm run security:scan

# License compliance
npm run license:check

# Full compliance check
npm run compliance:check
```

### Manual Security Review Checklist
- [ ] Input validation for all user-controlled data
- [ ] Path traversal prevention
- [ ] HTTPS enforcement for remote sources
- [ ] No hardcoded secrets or credentials
- [ ] Proper error handling without information disclosure
- [ ] File permissions and cleanup
- [ ] Dependencies are up-to-date and secure

## 🛠️ Dependency Security

### Dependency Management
- Keep dependencies updated regularly
- Monitor for security advisories
- Use `npm audit` to identify vulnerabilities
- Review dependency licenses for compliance

### Secure Dependency Practices
```json
// package.json security configurations
{
  "engines": {
    "node": ">=18.0.0",
    "vscode": "^1.90.0"
  },
  "scripts": {
    "security:audit": "npm audit --audit-level=moderate",
    "security:audit:fix": "npm audit fix"
  }
}
```

## 📊 Security Monitoring

### CI/CD Security Gates
- Security vulnerability scanning on every build
- License compliance checking
- Secret scanning in commits
- Static code analysis

### Runtime Security
- Monitor extension telemetry for anomalies (if added)
- Log security events appropriately  
- Rate limiting for remote requests
- Resource usage monitoring

## 🚨 Incident Response

### Security Issue Discovery
1. **Immediate Response:**
   - Document the issue privately
   - Assess impact and scope
   - Implement temporary mitigations if needed

2. **Coordination:**
   - Follow Microsoft security disclosure policy
   - Coordinate with security team if internal
   - Prepare patches and security updates

3. **Communication:**
   - Use SECURITY.md for reporting process
   - Prepare security advisories for significant issues
   - Update affected users through appropriate channels

### Vulnerability Reporting
- Report via SECURITY.md process
- Include reproduction steps
- Provide impact assessment
- Suggest potential mitigations

## 📋 Security Checklist for Releases

Before releasing new versions:
- [ ] Security audit passes without critical/high issues
- [ ] License compliance check passes
- [ ] No secrets or credentials in code
- [ ] Input validation tested
- [ ] Remote content handling secure
- [ ] Error handling doesn't leak info
- [ ] Dependencies updated and secure
- [ ] Security documentation updated

## 🔍 Additional Resources

- [Microsoft Security Development Lifecycle](https://www.microsoft.com/en-us/securityengineering/sdl)
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [VS Code Extension Security Guidelines](https://code.visualstudio.com/api/references/extension-manifest#extension-security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

Remember: Security is everyone's responsibility. When in doubt, ask for a security review!