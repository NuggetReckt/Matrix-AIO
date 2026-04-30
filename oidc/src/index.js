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
const {Provider} = require('oidc-provider');
const express = require('express');
const path = require('path');

// The redirect URI must match the exact public-facing Synapse origin used by the browser.
// If Synapse is served through HTTPS and a host name, this must be the public HTTPS URL,
// not the internal HTTP IP address.
const SYNAPSE_BASEURL = process.env.OIDC_SYNAPSE_BASEURL || 'https://matrix.local';
const PROVIDER_BASEURL = process.env.OIDC_PROVIDER_BASEURL || 'https://auth.local';
const PORT = process.env.OIDC_PORT || 3000;
const HOST = process.env.OIDC_HOST || '0.0.0.0';

const app = express();

app.use(express.json());

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

    // désactive les features inutiles au début
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
        Interaction: 3600,
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

// FOR DEBUGGING PURPOSES ONLY, TO SEE THE PROTOCOL USED BY THE REQUEST
// app.use((req, res, next) => {
//     console.log({
//         protocol: req.protocol,
//         secure: req.secure,
//         host: req.headers.host,
//         forwarded: req.headers['x-forwarded-proto']
//     });
//     next();
// });

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
        const { uid, prompt } = await provider.interactionDetails(req, res);

        if (prompt.name === 'login') {
            return res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>TriMessenger - Login</title>
                    <link rel="stylesheet" href="/assets/style.css">
                    <link rel="icon" type="image/png" href="/assets/img/favicon-96x96.png" sizes="96x96" />
                    <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg" />
                    <link rel="shortcut icon" href="/assets/img/favicon.ico" />
                    <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png" />
                    <meta name="apple-mobile-web-app-title" content="TriMessenger" />
                    <link rel="manifest" href="/assets/site.webmanifest" />
                </head>
                <body>
                    <form method="post" action="/interaction/${uid}">
                        <div class="header">
                            <img src="/assets/img/logo_trimaran.png" alt="logo_trimaran" class="logo"/>
                            <h1>Welcome Back</h1>
                            <h2>Login with your FXManager account</h2>
                        </div>
                        <div class="field">
                            <label>Username</label>
                            <input name="username" placeholder="Enter your username" required/>
                        </div>
                        <div class="field">
                            <label>Password</label>
                            <input name="password" type="password" placeholder="••••••••" required/>
                        </div>
                        <button type="submit">Login</button>
                    </form>
                </body>
                </html>
            `);
        }

        if (prompt.name === 'consent') {
            return res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>TriMessenger - Authorize</title>
                    <link rel="stylesheet" href="/assets/style.css">
                    <link rel="icon" type="image/png" href="/assets/img/favicon-96x96.png" sizes="96x96" />
                    <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg" />
                    <link rel="shortcut icon" href="/assets/img/favicon.ico" />
                    <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png" />
                    <meta name="apple-mobile-web-app-title" content="TriMessenger" />
                    <link rel="manifest" href="/assets/site.webmanifest" />
                </head>
                <body>
                    <form method="post" action="/interaction/${uid}">
                        <div class="header">
                            <img src="/assets/img/logo_trimaran.png" alt="logo_trimaran" class="logo"/>
                            <h1>Authorize</h1>
                            <h2>Allow access to your account to start chatting</h2>
                        </div>
                        <button type="submit">Allow</button>
                    </form>
                </body>
                </html>
            `);
        }

        return res.status(400).send('unknown prompt');
    })
    .post(express.urlencoded({ extended: false }), async (req, res) => {
        const { prompt, params, session, uid, grantId } =
            await provider.interactionDetails(req, res);

        if (prompt.name === 'login') {
            const user = users.find(
                u => u.username === req.body.username && u.password === req.body.password
            );

            if (!user) return res.status(401).send('invalid credentials');

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
                    return res.status(400).send('missing accountId');
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

            return provider.interactionFinished(
                req, res,
                {
                    consent: { grantId: newGrantId },
                },
                {
                    mergeWithLastSubmission: true,
                }
            );
        }

        return res.status(400).send('invalid interaction');
    });

app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// mount OIDC
app.use(provider.callback());

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
