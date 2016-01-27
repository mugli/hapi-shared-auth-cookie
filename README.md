# hapi-shared-auth-cookie

[**hapi**](https://github.com/hapijs/hapi) Shared Session Cookie authentication plugin. The session is supposed to be created by some other services, like PHP.

### Rationale of forking

This project is originally forked from [hapi-auth-cookie](https://github.com/hapijs/hapi-auth-cookie). I was using hapi as a smart proxy (with `h2o2`) in a project where majority of the stack was written in PHP. The goal was to rewrite the entire application in node, one endpoint at a time. The php application was responsible for creating session and maintaining it, and I needed to share that session with the hapi application as is.

The `hapi-auth-cookie` plugin was not meeting the purpose. It was designed to create its own session cookie, encrypt it with [Iron](https://github.com/hueniverse/iron) and there was no way of not doing that [without creating a fork](https://github.com/hapijs/hapi-auth-cookie/issues/100#issuecomment-167844104).

To be clear, this plugin is NOT supposed to
- Create session/cookie, it will be dealt elsewhere in other application.
- Encrypt or modify session cookie in anyway. It should just check if a given cookie is present and validate rest of the things using `validateFunc`. The only exception is `keepAlive`. If set, it'll keep refreshing the cookie with its original ttl.
- Clear invalid cookie. The operations of this plugin on the session cookie has to be readonly.


### Description

Cookie authentication provides a simple cookie-based session management. The user has to be
authenticated via other means, typically a web form, and upon successful authentication,
receive a reply with a session cookie. Subsequent requests containing the session cookie are
authenticated and validated via the provided `validateFunc`.

The `'cookie`' scheme takes the following required options:

- `cookie` - the cookie name. Defaults to `'PHPSESSID'`.

- `validateFunc` - a session validation function used to validate the content of the
  session cookie on each request or where the auth strategy is defined. Used to verify that the internal session state is still valid
  (e.g. user account still exists). The function has the signature `function(request, session, callback)`
  where:
    - `request` - is the Hapi request object of the request which is being authenticated.
    - `session` - is the session value of the cookie defined above, if present.
    - `callback` - a callback function with the signature `function(err, isValid, credentials)`
      where:
        - `err` - an internal error.
        - `isValid` - `true` if the content of the session is valid, otherwise `false`.
        - `credentials` - a credentials object passed back to the application in
          `request.auth.credentials` and also in `request.auth.artifacts`. If value is `null` or `undefined`, defaults to `session`.


```javascript
'use strict';

// ...

server.auth.strategy('session', 'shared-cookie', false, {
  cookie: 'PHPSESSID',
  validateFunc(request, session, callback) {
    if (!session) {
      return callback(new Error('Invalid session'), false);
    }

    // Sharing session via AWS DynamoDB
    const params = {
      TableName: dynamoDBConfig.tableName,
      Key: {
        id: {
          S: `PHPSESSID_${session}`
        }
      }
    };

    // AWS DynamoDB Client initialized elsewhere
    docClient.getItem(params, function (error, data) {
      if (error) {
        console.log(error);
        return callback(error, false);
      }

      const sessionData = phpUnserialize.unserializeSession(data.Item.data.S);
      console.log(sessionData); // successful response

      if (!!sessionData.user_id) {
        return callback(null, true, sessionData);
      }

      return callback(new Error('Invalid session'), false);
    });
  }
});

// ...

```

The original README can be found [here](https://github.com/mugli/hapi-shared-auth-cookie/blob/master/README_ORIGINAL.md).
