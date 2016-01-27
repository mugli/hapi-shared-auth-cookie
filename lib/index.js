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
    cookie: Joi.string().default('PHPSESSID'),
    keepAlive: Joi.boolean().default(false),
    validateFunc: Joi.func().required(),
    artifactSetterFunc: Joi.func(),
    artifactClearFunc: Joi.func(),
    artifactClearAllFunc: Joi.func()
}).required();

internals.implementation = function (server, options) {

    const results = Joi.validate(options, internals.schema);
    Hoek.assert(!results.error, results.error);

    const settings = results.value;

    const setSessionArtifact = function (key, value) {

        const session = this.auth.artifacts;
        Hoek.assert(session, 'No active session to apply key to');

        Hoek.assert(!!settings.artifactSetterFunc, 'artifactSetterFunc not defined');
        this.auth.artifacts = settings.artifactSetterFunc(key, value);
    }

    const clearSessionArtifact = function (key) {

        const session = this.auth.artifacts;
        Hoek.assert(session, 'No active session to clear key from');

        Hoek.assert(!!settings.artifactClearFunc, 'artifactClearFunc not defined');
        this.auth.artifacts = settings.artifactClearFunc(key);
    }

    const clearAllSessionArtifact = function(){
        const session = this.auth.artifacts;
        Hoek.assert(session, 'No active session to clear key from');

        Hoek.assert(!!settings.artifactClearAllFunc, 'artifactClearAllFunc not defined');
        this.auth.artifacts = settings.artifactClearAllFunc(key);
    }

    server.decorate('request', 'setSessionArtifact', setSessionArtifact);
    server.decorate('request', 'clearSessionArtifact', clearSessionArtifact);
    server.decorate('request', 'clearAllSessionArtifact', clearAllSessionArtifact);


    const scheme = {
        authenticate: function (request, reply) {

            const validate = function () {

                // Check cookie

                const session = request.state[settings.cookie];
                if (!session) {
                    return unauthenticated(Boom.unauthorized(null, 'cookie not found'));
                }

                settings.validateFunc(request, session, (err, isValid, credentials) => {

                    if (err ||
                        !isValid) {

                        return unauthenticated(Boom.unauthorized('Invalid cookie'));
                    }

                    if (settings.keepAlive) {
                        reply.state(settings.cookie, session);
                    }

                    return reply.continue({ credentials: credentials || session, artifacts: credentials || session });
                });
            };

            const unauthenticated = function (err) {

                return reply(err, null);
            };

            validate();
        }
    };

    return scheme;
};
