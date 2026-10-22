// Removes credentials from a request URL before it is written to a log.
//
// The LinkedIn OAuth callback arrives as GET ...?code=...&state=..., and both
// the request logger and the error handler record the URL. An authorization
// code is exchangeable for a token for 30 minutes, and the state is what makes
// the callback trustworthy, so neither may reach a log file. Any parameter in
// SENSITIVE_PARAMS is kept by name with its value replaced.
const SENSITIVE_PARAMS = ['code', 'state', 'access_token', 'refresh_token', 'client_secret'];

const redactUrl = (url) => {
    const raw = String(url || '');
    const q = raw.indexOf('?');
    if (q === -1) return raw;
    const params = new URLSearchParams(raw.slice(q + 1));
    let changed = false;
    for (const name of SENSITIVE_PARAMS) {
        if (params.has(name)) {
            params.set(name, 'REDACTED');
            changed = true;
        }
    }
    return changed ? `${raw.slice(0, q)}?${params.toString()}` : raw;
};

module.exports = { redactUrl, SENSITIVE_PARAMS };
