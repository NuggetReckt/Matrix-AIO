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
const {Provider, errors: { SessionNotFound, InteractionNotFound }} = require('oidc-provider');
const express = require('express');
const path = require('path');
const { renderLoginPage, renderConsentPage, renderGenericErrorPage } = require('./renderer');

// The redirect URI must match the exact public-facing Synapse origin used by the browser.
// If Synapse is served through HTTPS and a host name, this must be the public HTTPS URL,
// not the internal HTTP IP address.
const SYNAPSE_BASEURL = process.env.OIDC_SYNAPSE_BASEURL || 'https://matrix.local';
const PROVIDER_BASEURL = process.env.OIDC_PROVIDER_BASEURL || 'https://auth.local';
const PORT = process.env.OIDC_PORT || 3000;
const HOST = process.env.OIDC_HOST || '0.0.0.0';

const app = express();

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
        openid: ['sub'],
        profile: ['preferred_username'],
        email: ['email'],
    },

    features: {
        devInteractions: {enabled: false},
    },
};

configuration.findAccount = async (ctx, id) => {
    const user = users.find(u => u.id.toString() === id);

    if (!user) return undefined;

    return {
        accountId: id,
        async claims() {
            return {
                sub: id.toString(),
                preferred_username: user.username,
                email: user.email
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
            sameSite: 'lax',
            secure: true,
        },
        short: {
            sameSite: 'lax',
            secure: true,
        },
    },
    ttl: {
        Interaction: 3600, // 1 hour in seconds
        Session: 86400, // 24 hours in seconds
    },
});

// Fake users
const users = [
    {id: 1, username: 'john', email: 'john@test.local', password: 'test'},
    {id: 2, username: 'marie', email: 'marie@test.local', password: 'test'},
    {id: 3, username: 'corto', email: 'corto@test.local', password: 'test'}
]
let nextId = users.length + 1;

app.enable('trust proxy');

app.get('/users', (req, res) => {
    res.json(users);
})

app.get('/user/:userId', (req, res) => {
    const user = users.find(user => user.id === parseInt(req.params['userId']));

    if (!user) {
        res.status(404).json({message: 'User not found'});
        return;
    }
    res.json(user);
})

app.post('/user', (req, res) => {
    const user = {
        id: nextId,
        username: req.body.username,
        password: req.body.password
    }
    users.push(user);
    res.status(200).json({userId: user.id});
    nextId++;
})

app.delete('/user/:userId', (req, res) => {
    const user = users.find(user => user.id === parseInt(req.params['userId']));
    if (!user) {
        res.status(404).json({message: 'User not found'});
        return;
    }
    users.splice(users.indexOf(user), 1);
    res.status(200).json({message: 'User deleted'});
})


app.route('/interaction/:uid')
    .get(async (req, res) => {
        try {
            const { uid, prompt } = await provider.interactionDetails(req, res);
            const errorMessage = getErrorMessage(req.query.error);
            const username = req.query.username || '';

            if (prompt.name === 'login') {
                return res.send(renderLoginPage(uid, errorMessage, username));
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
                const user = users.find(
                    u => u.username === req.body.username && u.password === req.body.password
                );

                if (!user) {
                    return res.redirect(`/interaction/${uid}?error=invalid_credentials&username=${encodeURIComponent(req.body.username || '')}`);
                }

                return provider.interactionFinished(req, res, {
                    login: { accountId: user.id.toString() },
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
