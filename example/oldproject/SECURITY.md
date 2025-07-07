# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in this project, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Instead, please email the maintainer directly with details
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Security Best Practices

### 1. Credential Management

- **Never commit credentials**: Use environment variables for all sensitive data
- **Use .env files locally**: Keep credentials in `.env` (already gitignored)
- **Rotate credentials regularly**: Especially after any potential exposure
- **Use different credentials** for development, staging, and production

### 2. OAuth 2.0 Security

- **Revoke compromised tokens immediately** in Zoho API Console
- **Limit OAuth scopes** to only what's necessary
- **Monitor API usage** for unusual patterns
- **Use HTTPS only** for all API communications

### 3. Pre-commit Hook

This project includes a pre-commit hook that:
- Prevents committing `.env` files
- Scans for potential secrets in code
- Warns about sensitive patterns

To bypass in emergencies (not recommended):
```bash
git commit --no-verify
```

### 4. Error Handling

The project includes security-conscious error handling:
- Sensitive data is automatically redacted from error details
- Error messages don't expose implementation details
- API responses are sanitized before logging

### 5. Dependencies

- Run `npm audit` regularly to check for vulnerabilities
- Keep dependencies up to date
- Review dependency licenses for compatibility

## Security Checklist for Deployment

- [ ] All credentials are loaded from environment variables
- [ ] `.env` file is never committed or deployed
- [ ] Pre-commit hooks are installed and active
- [ ] OAuth credentials have appropriate scope restrictions
- [ ] Error logging doesn't expose sensitive data
- [ ] HTTPS is enforced for all API communications
- [ ] Rate limiting is properly configured
- [ ] API usage is monitored for anomalies

## Known Security Considerations

1. **Token Storage**: OAuth tokens are stored in memory only (not persisted)
2. **Rate Limiting**: Default 60 requests/minute (configurable)
3. **Input Validation**: All MCP tool inputs are validated with Zod schemas
4. **HTTPS Only**: API client enforces HTTPS for all requests

## Emergency Response

If credentials are exposed:

1. **Immediately revoke** the exposed credentials:
   - Go to [Zoho API Console](https://api-console.zoho.com/)
   - Find your client application
   - Regenerate or revoke the compromised credentials
   
2. **Generate new credentials**
3. **Update all environments** with new credentials
4. **Review logs** for any unauthorized access
5. **Notify affected users** if necessary

## Additional Resources

- [OWASP Security Guidelines](https://owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Service Desk Plus API Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/)