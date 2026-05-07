//                              _|                _|                          _|
//  _|_|_|  _|_|      _|_|_|  _|_|_|_|  _|  _|_|      _|    _|        _|_|_|        _|_|
//  _|    _|    _|  _|    _|    _|      _|_|      _|    _|_|        _|    _|  _|  _|    _|
//  _|    _|    _|  _|    _|    _|      _|        _|  _|    _|      _|    _|  _|  _|    _|
//  _|    _|    _|    _|_|_|      _|_|  _|        _|  _|    _|        _|_|_|  _|    _|_|
//
// Trimaran VFX 2026 - Corto Morrow
// renderer.js - Rendering functions for OIDC provider implementation, generating HTML pages for login, consent, and error states.

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderErrorCard(message) {
    if (!message) return '';
    return `<div class="error-card">${escapeHtml(message)}</div>`;
}

function renderPage(title, bodyHtml, errorMessage) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapeHtml(title)}</title>
            <link rel="stylesheet" href="/assets/style.css">
            <link rel="icon" type="image/png" href="/assets/img/favicon-96x96.png" sizes="96x96" />
            <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg" />
            <link rel="shortcut icon" href="/assets/img/favicon.ico" />
            <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png" />
            <meta name="apple-mobile-web-app-title" content="TriMessenger" />
            <link rel="manifest" href="/assets/site.webmanifest" />
        </head>
        <body>
            ${renderErrorCard(errorMessage)}
            <div class="card">
                ${bodyHtml}
            </div>
        </body>
        </html>
    `;
}

function renderLoginPage(uid, error, email = '') {
    return renderPage('TriMessenger - Login', `
            <form method="post" action="/interaction/${escapeHtml(uid)}">
                <div class="header">
                    <img src="/assets/img/logo_trimaran.png" alt="logo_trimaran" class="logo"/>
                    <h1>Welcome Back</h1>
                    <h2>Login with your FXManager account</h2>
                </div>
                <div class="field">
                    <label>Email</label>
                    <input name="email" type="email" placeholder="Enter your email" value="${escapeHtml(email)}" required/>
                </div>
                <div class="field">
                    <label>Password</label>
                    <input name="password" type="password" placeholder="••••••••" required/>
                </div>
                <button type="submit">Login</button>
            </form>
        `, error);
}

function renderConsentPage(uid, error) {
    return renderPage('TriMessenger - Authorize', `
            <form method="post" action="/interaction/${escapeHtml(uid)}">
                <div class="header">
                    <img src="/assets/img/logo_trimaran.png" alt="logo_trimaran" class="logo"/>
                    <h1>Authorize</h1>
                    <h2>Allow access to your account to start chatting</h2>
                </div>
                <button type="submit">Allow</button>
            </form>
        `, error);
}

function renderGenericErrorPage(error) {
    return renderPage('TriMessenger - Error', `
            <div class="header">
                <img src="/assets/img/logo_trimaran.png" alt="logo_trimaran" class="logo"/>
                <h1>Something went wrong</h1>
                <h2>Please try again</h2>
            </div>
        `, error);
}

module.exports = {
    renderLoginPage,
    renderConsentPage,
    renderGenericErrorPage,
};
