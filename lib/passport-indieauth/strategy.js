/**
 * Module dependencies.
 */
var mf = require('microformat-node');
var passport = require('passport-strategy');
var requester = require('request');
var querystring = require('querystring');
var util = require('util');
var _ = require('underscore');

/**
 * `Strategy` constructor.
 *
 * The IndieAuth authentication strategy authenticates requests by delegating to
 * an IndieAuth server using the IndieAuth protocol, which handles third-party
 * authentication validation itself.
 *
 * Options:
 *   `service`:       the URI for the IndieAuth service (by default `https://indieauth.com/auth`)
 *   `client_id`:     your client ID (i.e. your application's identity, typically your domain)
 *   `redirect_uri`:  your website's callback URL.
 *
 * Examples:
 *
 *     passport.use(new IndieAuthStrategy({
 *       service: "https://indieauth.com/auth",
 *       client_id: "https://yourdomain.com",
 *       redirect_uri: "http://yourdomain.com/auth/indieauth/callback"
 *       },
 *       function(profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
  options = options || {};
  options.service = options.service || 'https://indieauth.com/auth';

  passport.Strategy.call(this);
  this.name = 'indieauth';
  this._verify = verify;
  this._service = options.service;
  this._clientId = options.clientID;
  this._callbackUrl = options.callbackURL;
  this._passReqToCallback = options.passReqToCallback;
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Strategy, passport.Strategy);

Strategy.prototype.authenticate = function(req, options, verify) {
  var self = this;
  if(req.query && req.query.code) {
    var code = req.query.code;
    requester.post({
      uri: service,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: 'code=' + code + '&client_id=' + client_id + '&redirect_uri=' + redirect_uri
    }, function(err, response, body) {
      if(response.statusCode!=200) {
        var errDesc = querystring.parse(body);
            errDesc = errDesc.error_description;
        this.error(response.statusCode, errDesc);
      } else {
        var domain = querystring.parse(body);
            domain = domain.me;

        self.userProfile(profile, function() {
          function verified(err, user, info) {
            if (err) { return self.error(err); }
            if (!user) { return self.fail(info); }
            self.success(user, info);
          }
          try {
            if (self._passReqToCallback) {
              var arity = self._verify.length;
              if (arity == 4) {
                self._verify(req, params, profile, verified);
              } else { // arity == 3
                self._verify(req, profile, verified);
              }
            } else {
              var arity = self._verify.length;
              if (arity == 3) {
                self._verify(params, profile, verified);
              } else { // arity == 2
                self._verify(profile, verified);
              }
            }
          } catch (ex) {
            return self.error(ex);
          }
        });
      }
    });
  }
}

/**
 * Retrieve user profile from user's verified domain.
 *
 * This function constructs a normalized(ish) profile, with the following properties:
 *
 *   - `provider`         always set to `indieauth`
 *   - `id`               always set to the user's domain
 *   - Whatever available h-card properties are appended to the user profile.
 *   - No Portable Contacts Unifed Profile Schema
 *
 * @param {String} domain
 * @param {Function} done
 * @api protected
 */
Strategy.prototype.userProfile = function(domain, done) {
  mf.parseUrl(domain, { 'filters': ['h-card'] }, function(err, data) {
    if(err) {
      done(err, null);
    } else {
      var profile = {
        provider: 'indieauth',
        id: domain,
      };
      // Assumes the first h-card parsed on any page is the user's.
      // This is a known false assumption for some percentage of users.
      // It'll get fixed in an update at some point.
      var hcard;
      if(data.rels) {
        var relMe = data.rels.me;
        hcard = _.findWhere(data.items, { url: [relMe[0]] });
        if(!hcard) {
          hcard = data.items[0].properties;
        } else {
          hcard = { url: domain };
        }
      } else {
        hcard = { url: domain };
      }
      profile = _.extend(profile, hcard);
      done(null, profile);
    }
  });
}


/**
 * Expose `Strategy`.
 */
module.exports = Strategy;