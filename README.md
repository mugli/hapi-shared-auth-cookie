# hapi-shared-auth-cookie

[**hapi**](https://github.com/hapijs/hapi) Shared Session Cookie authentication plugin. The session is supposed to be created by some other services, like PHP.

### Rationale of forking

This project is originally forked from [hapi-auth-cookie](https://github.com/hapijs/hapi-auth-cookie). I was using hapi as a smart proxy (with `h2o2`) in a project where majority of the stack was written in PHP. The goal was to rewrite the entire application in node, one endpoint at a time. The php application created session and maintains it, and I needed to share that session with the hapi application as is.

The `hapi-auth-cookie` plugin was not meeting the purpose. It was designed to create its own session cookie, encrypt it with [Iron](https://github.com/hueniverse/iron) and there was no way of not doing that [without creating a fork](https://github.com/hapijs/hapi-auth-cookie/issues/100#issuecomment-167844104).

So, to be clear, this plugin is NOT supposed to
- Create session/cookie, it will be dealt elsewhere.
- Encrypt or modify session cookie in anyway. It should just check if a given cookie is present and validate rest of the things using `validateFunc`.
- Clear invalid cookie. The operations of this plugin should be readonly.


### Description

Cookie authentication provides a simple cookie-based session management. The user has to be
authenticated via other means, typically a web form, and upon successful authentication,
receive a reply with a session cookie. Subsequent requests containing the session cookie are
authenticated and validated via the provided `validateFunc`.

The `'cookie`' scheme takes the following required options:

- `cookie` - the cookie name. Defaults to `'PHPSESSID'`.

- `validateFunc` - a session validation function used to validate the content of the
  session cookie on each request. Used to verify that the internal session state is still valid
  (e.g. user account still exists). The function has the signature `function(request, session, callback)`
  where:
    - `request` - is the Hapi request object of the request which is being authenticated.
    - `session` - is the session object set via `request.cookieAuth.set()`.
    - `callback` - a callback function with the signature `function(err, isValid, credentials)`
      where:
        - `err` - an internal error.
        - `isValid` - `true` if the content of the session is valid, otherwise `false`.
        - `credentials` - a credentials object passed back to the application in
          `request.auth.credentials`. If value is `null` or `undefined`, defaults to `session`. If
          set, will override the current cookie as if `request.cookieAuth.set()` was called.

When the cookie scheme is enabled on a route, the `request.cookieAuth` objects is decorated with
the following methods:
- `set(session)` - sets the current session. Must be called after a successful login to begin the
  session. `session` must be a non-null object, which is set on successful subsequent
  authentications in `request.auth.credentials` where:
    - `session` - the session object.
- `set(key, value)` - sets a specific object key on the current session (which must already exist)
  where:
    - `key` - session key string.
    - `value` - value to assign key.
- `clear([key])` - clears the current session or session key where:
    - `key` - optional key string to remove a specific property of the session. If none provided,
      defaults to removing the entire session which is used to log the user out.
- `ttl(msecs)` - sets the ttl of the current active session where:
    - `msecs` - the new ttl in milliseconds.

Because this scheme decorates the `request` object with session-specific methods, it cannot be
registered more than once.

```javascript
'use strict';

const Hapi = require('hapi');

let uuid = 1;       // Use seq instead of proper unique identifiers for demo only

const users = {
    john: {
        id: 'john',
        password: 'password',
        name: 'John Doe'
    }
};

const home = function (request, reply) {

    reply('<html><head><title>Login page</title></head><body><h3>Welcome ' +
      request.auth.credentials.name +
      '!</h3><br/><form method="get" action="/logout">' +
      '<input type="submit" value="Logout">' +
      '</form></body></html>');
};

const login = function (request, reply) {

    if (request.auth.isAuthenticated) {
        return reply.redirect('/');
    }

    let message = '';
    let account = null;

    if (request.method === 'post') {

        if (!request.payload.username ||
            !request.payload.password) {

            message = 'Missing username or password';
        }
        else {
            account = users[request.payload.username];
            if (!account ||
                account.password !== request.payload.password) {

                message = 'Invalid username or password';
            }
        }
    }

    if (request.method === 'get' ||
        message) {

        return reply('<html><head><title>Login page</title></head><body>' +
            (message ? '<h3>' + message + '</h3><br/>' : '') +
            '<form method="post" action="/login">' +
            'Username: <input type="text" name="username"><br>' +
            'Password: <input type="password" name="password"><br/>' +
            '<input type="submit" value="Login"></form></body></html>');
    }

    const sid = String(++uuid);
    request.server.app.cache.set(sid, { account: account }, 0, (err) => {

        if (err) {
            reply(err);
        }

        request.cookieAuth.set({ sid: sid });
        return reply.redirect('/');
    });
};

const logout = function (request, reply) {

    request.cookieAuth.clear();
    return reply.redirect('/');
};

const server = new Hapi.Server();
server.connection({ port: 8000 });

server.register(require('../'), (err) => {

    if (err) {
        throw err;
    }

    const cache = server.cache({ segment: 'sessions', expiresIn: 3 * 24 * 60 * 60 * 1000 });
    server.app.cache = cache;

    server.auth.strategy('session', 'cookie', true, {
        password: 'secret',
        cookie: 'sid-example',
        redirectTo: '/login',
        isSecure: false,
        validateFunc: function (request, session, callback) {

            cache.get(session.sid, (err, cached) => {

                if (err) {
                    return callback(err, false);
                }

                if (!cached) {
                    return callback(null, false);
                }

                return callback(null, true, cached.account);
            });
        }
    });

    server.route([
        { method: 'GET', path: '/', config: { handler: home } },
        { method: ['GET', 'POST'], path: '/login', config: { handler: login, auth: { mode: 'try' }, plugins: { 'hapi-auth-cookie': { redirectTo: false } } } },
        { method: 'GET', path: '/logout', config: { handler: logout } }
    ]);

    server.start(() => {

        console.log('Server ready');
    });
});
```

The original README can be found [here](https://github.com/mugli/hapi-shared-auth-cookie/blob/master/README_ORIGINAL.md).
