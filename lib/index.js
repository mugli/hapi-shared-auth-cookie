'use strict';

// Load modules

const Boom = require('boom');
const Hoek = require('hoek');
const Joi = require('joi');

// Declare internals

const internals = {};


exports.register = function (server, options, next) {

    server.auth.scheme('shared-cookie', internals.implementation);
    next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};

internals.schema = Joi.object({
    cookie: Joi.string().default('sid'),
    keepAlive: Joi.boolean().default(false),
    validateFunc: Joi.func().required(),
    getterFunc: Joi.func().required(),
    setterFunc: Joi.func()
}).required();

internals.implementation = function (server, options) {

    const results = Joi.validate(options, internals.schema);
    Hoek.assert(!results.error, results.error);

    const settings = results.value;

    const cookieOptions = {
        encoding: 'none',
        ignoreErrors: true
    };

    server.state(settings.cookie, cookieOptions);

    const scheme = {
        authenticate: function (request, reply) {

            const validate = function () {

                // Check cookie

                const session = request.state[settings.cookie];
                if (!session) {
                    return unauthenticated(Boom.unauthorized(null, 'cookie'));
                }

                settings.validateFunc(request, session, (err, isValid, credentials) => {

                    if (err ||
                        !isValid) {

                        return unauthenticated(Boom.unauthorized('Invalid cookie'), { credentials: credentials || session, artifacts: session });
                    }

                    if (settings.keepAlive) {
                        reply.state(settings.cookie, session);
                    }

                    return reply.continue({ credentials: credentials || session, artifacts: session });
                });
            };

            const unauthenticated = function (err, result) {

                return reply(err, null, result);
            };

            validate();
        }
    };

    return scheme;
};
