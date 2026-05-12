//                              _|                _|                          _|
//  _|_|_|  _|_|      _|_|_|  _|_|_|_|  _|  _|_|      _|    _|        _|_|_|        _|_|
//  _|    _|    _|  _|    _|    _|      _|_|      _|    _|_|        _|    _|  _|  _|    _|
//  _|    _|    _|  _|    _|    _|      _|        _|  _|    _|      _|    _|  _|  _|    _|
//  _|    _|    _|    _|_|_|      _|_|  _|        _|  _|    _|        _|_|_|  _|    _|_|
//
// Trimaran VFX 2026 - Corto Morrow
// index.js - App entry point for OIDC provider implementation using the oidc-provider library

const https = require('https');
const fs = require('fs');
const { Provider, errors: { SessionNotFound, InteractionNotFound }} = require('oidc-provider');
const axios = require('axios');
const express = require('express');
const path = require('path');
const { renderLoginPage, renderConsentPage, renderGenericErrorPage } = require('./renderer');
const FileAdapter = require('./fileAdapter');

const SYNAPSE_BASEURL = process.env.OIDC_SYNAPSE_BASEURL || 'https://matrix.local';
const PROVIDER_BASEURL = process.env.OIDC_PROVIDER_BASEURL || 'https://auth.local';
const FXMANAGER_BASEURL = process.env.OIDC_FXMANAGER_BASEURL || 'https://fxmanager.local';
const PORT = process.env.OIDC_PORT || 3000;
const HOST = process.env.OIDC_HOST || '0.0.0.0';
const DEBUG = process.env.OIDC_DEBUG || 'false';

const app = express();
const client = axios.create({
    baseURL: FXMANAGER_BASEURL,
    timeout: 1000
});

app.use(express.json());

function getErrorMessage(errorKey) {
    switch (errorKey) {
        case 'invalid_credentials':
            return 'Invalid credentials.';
        case 'missing_accountId':
            return 'Missing accountId.';
        case 'invalid_interaction':
            return 'Invalid interaction.';
        case 'unknown_prompt':
            return 'Unknown prompt.';
        case 'session_not_found':
            return 'Session not found or has expired.';
        default:
            return '';
    }
}

// config OIDC
const configuration = {
    // client Synapse
    clients: [
        {
            client_id: 'synapse',
            client_secret: 'secret',
            redirect_uris: [SYNAPSE_BASEURL + '/_synapse/client/oidc/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            token_endpoint_auth_method: 'client_secret_post',
        },
    ],

    // mapping des claims
    claims: {
        openid: ['sub', 'preferred_username'],
        profile: ['preferred_username'],
        email: ['email'],
    },

    features: {
        devInteractions: {enabled: false},
    },

    adapter: (name) => new FileAdapter(name),

    jwks: {
        keys: [
            {
                kty: 'RSA',
                n: '',
                e: '',
                d: '',
                p: '',
                q: '',
                dp: '',
                dq: '',
                qi: '',
                alg: 'RS256',
                kid: 'key-1',
                use: 'sig'
            }
        ]
    },
};

const accountCache = new Map();

configuration.findAccount = async (ctx, id) => {
    const account = accountCache.get(id) || { email: id, username: id };

    return {
        accountId: id,
        async claims() {
            return {
                sub: id.toString(),
                preferred_username: account.username,
                email: account.email
            };
        }
    };
};

// provider init
const provider = new Provider(PROVIDER_BASEURL, {
    ...configuration,

    proxy: true,

    issuer: PROVIDER_BASEURL,
    clientBasedCORS: () => true,

    routes: {
        authorization: '/authorize',
        token: '/token',
        userinfo: '/userinfo',
    },
    cookies: {
        keys: ['super_secret_key_1', 'super_secret_key_2'],
        long: {
            sameSite: 'none',
            secure: true,
            httpOnly: true,
        },
        short: {
            sameSite: 'none',
            secure: true,
            httpOnly: true,
        },
    },
    ttl: {
        Interaction: 3600, // 1 hour in seconds
        Session: 86400, // 24 hours in seconds
        AccessToken: 3600, // 1 hour in seconds
        IdToken: 3600, // 1 hour in seconds
        AuthorizationCode: 600, // 10 minutes in seconds
        Grant: 86400, // 24 hours in seconds
    },
});

app.enable('trust proxy');

// Helper function to convert email to valid Matrix localpart
function emailToMatrixLocalpart(email) {
    const local = String(email || '')
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9._=-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_\.=-]+|[_\.=-]+$/g, '');

    return local || 'user';
}

app.route('/interaction/:uid')
    .get(async (req, res) => {
        try {
            const { uid, prompt } = await provider.interactionDetails(req, res);
            const errorMessage = getErrorMessage(req.query.error);
            const email = req.query.email || '';

            if (prompt.name === 'login') {
                return res.send(renderLoginPage(uid, errorMessage, email));
            }

            if (prompt.name === 'consent') {
                return res.send(renderConsentPage(uid, errorMessage));
            }

            return res.status(400).send(renderGenericErrorPage(getErrorMessage('unknown_prompt')));
        } catch (err) {
            if (err instanceof SessionNotFound || err instanceof InteractionNotFound) {
                return res.status(400).send(renderGenericErrorPage(getErrorMessage('session_not_found')));
            }
            return res.status(500).send(renderGenericErrorPage('An unexpected error occurred.'));
        }
    })
    .post(express.urlencoded({ extended: false }), async (req, res) => {
        try {
            const { prompt, params, session, uid, grantId } = await provider.interactionDetails(req, res);

            if (prompt.name === 'login') {
                let authResponse;

                try {
                    const response = await client.post('/process_auth.php', {
                        action: 'verify_login',
                        email: req.body.email,
                        password: req.body.password,
                    });

                    authResponse = response.data;
                } catch (err) {
                    return res.redirect(`/interaction/${uid}?error=invalid_credentials&email=${encodeURIComponent(req.body.email || '')}`);
                }

                if (!authResponse || authResponse.status !== 'allowed') {
                    return res.redirect(`/interaction/${uid}?error=invalid_credentials&email=${encodeURIComponent(req.body.email || '')}`);
                }

                const accountEmail = authResponse.email || req.body.email;
                const preferredUsername = emailToMatrixLocalpart(authResponse.username || accountEmail);
                const accountId = preferredUsername;

                accountCache.set(accountId, {
                    email: accountEmail,
                    username: preferredUsername,
                });

                return provider.interactionFinished(req, res, {
                    login: { accountId: accountId.toString() },
                });
            }

            if (prompt.name === 'consent') {
                let grant;

                if (grantId) {
                    grant = await provider.Grant.find(grantId);
                } else {
                    const accountId = session?.accountId;

                    if (!accountId) {
                        return res.redirect(`/interaction/${uid}?error=missing_accountId`);
                    }

                    grant = new provider.Grant({
                        accountId,
                        clientId: params.client_id,
                    });
                }

                grant.addOIDCScope('openid');
                grant.addOIDCScope('profile');
                grant.addOIDCScope('email');

                const newGrantId = await grant.save();

                return provider.interactionFinished(req, res,
                    {
                        consent: { grantId: newGrantId },
                    },
                    {
                        mergeWithLastSubmission: true,
                    }
                );
            }

            return res.redirect(`/interaction/${uid}?error=invalid_interaction`);
        } catch (err) {
            if (err instanceof SessionNotFound || err instanceof InteractionNotFound) {
                return res.status(400).send(renderGenericErrorPage(getErrorMessage('session_not_found')));
            }
            return res.status(500).send(renderGenericErrorPage('An unexpected error occurred.'));
        }
    });

// serve static assets
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// debug token/userinfo/authorize requests before provider callback
app.use((req, res, next) => {
    if (DEBUG !== 'true') {
        return next();
    }

    if (['/authorize', '/token', '/userinfo'].includes(req.path)) {
        console.log('[OIDC REQUEST]', req.method, req.path, {
            query: req.query,
            body: req.body,
            headers: {
                host: req.headers.host,
                referer: req.headers.referer,
                origin: req.headers.origin,
            },
        });
    }
    next();
});

// mount OIDC
app.use(provider.callback());

// middleware for handling interaction errors
app.use((err, _req, _res, next) => {
    if (err instanceof SessionNotFound || err instanceof InteractionNotFound) {
        return _res.status(400).send(renderGenericErrorPage(getErrorMessage('session_not_found')));
    }
    next(err);
});

// start app
https.createServer({
    key: fs.readFileSync('./certs/privkey.pem'),
    cert: fs.readFileSync('./certs/fullchain.pem'),
}, app).listen(PORT, HOST, () => {
    console.log('OIDC provider running on ' + HOST + ':' + PORT);
    console.log(' - Synapse base URL: ' + SYNAPSE_BASEURL);
    console.log(' - Redirect URI: ' + SYNAPSE_BASEURL + '/_synapse/client/oidc/callback');
    console.log(' - Provider base URL: ' + PROVIDER_BASEURL);
});
