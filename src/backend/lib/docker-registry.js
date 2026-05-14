'use strict';

const _    = require('lodash');
const rest = require('restler');
const http = require('http');
const https = require('https');
const url  = require('url');
const logger = require('../logger').global;

module.exports = function (domain, use_ssl, username, password) {

    this._baseurl    = 'http' + (use_ssl ? 's' : '') + '://' + domain + '/v2/';
    this._username   = username || '__token__';
    this._password   = password || '';
    this._token      = null;
    this._tokenExp   = 0;
    this._authServer = process.env.AUTH_SERVER || 'http://host.docker.internal:8000/token';

    var self = this;

    this._fetchToken = function (scope) {
        return new Promise(function (resolve, reject) {
            var params = 'service=' + encodeURIComponent(domain) +
                         '&scope=' + encodeURIComponent(scope || '') +
                         '&account=' + encodeURIComponent(self._username);

            var tokenUrl = self._authServer + '?' + params;
            var proto    = tokenUrl.startsWith('https') ? https : http;

            var headers = { 'User-Agent': 'Docker Registry UI' };
            if (self._username && self._password) {
                var b64 = Buffer.from(self._username + ':' + self._password).toString('base64');
                headers['Authorization'] = 'Basic ' + b64;
                logger.info(self._password , self._username);
            }

            var reqUrl  = url.parse(tokenUrl);
            reqUrl.headers = headers;
            logger.info(reqUrl);
            proto.get(reqUrl, function (res) {
                var data = '';
                res.on('data', function (chunk) { data += chunk; });
                res.on('end', function () {
                    try {
                        console.log(data);
                        var parsed = JSON.parse(data);
                        if (!parsed.token) return reject(new Error('No token in response: ' + data));
                        self._token    = parsed.token;
                        self._tokenExp = Date.now() + ((parsed.expires_in || 300) - 10) * 1000;
                        resolve(parsed.token);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', function (e) { reject(e); });
        });
    };

    this._getToken = function (scope) {
        if (self._token && Date.now() < self._tokenExp) {
            return Promise.resolve(self._token);
        }
        return self._fetchToken(scope);
    };

    this.getUrlOptions = function (version, token) {
        var options = {
            headers: {
                'User-Agent':    'Docker Registry UI',
                'Authorization': 'Bearer ' + token
            }
        };

        if (version === 2) {
            // Accept both Docker v2 and OCI manifest formats
            options.headers.Accept = [
                'application/vnd.docker.distribution.manifest.v2+json',
                'application/vnd.docker.distribution.manifest.list.v2+json',
                'application/vnd.oci.image.manifest.v1+json',
                'application/vnd.oci.image.index.v1+json',
                '*/*'
            ].join(', ');
        }

        return options;
    };

    this.getImages = function (limit) {
        limit = limit || 300;
        return self._getToken('registry:catalog:*')
            .then(function (token) {
                return new Promise(function (resolve, reject) {
                    rest.get(self._baseurl + '_catalog?n=' + limit, self.getUrlOptions(1, token))
                        .on('timeout', function (ms) { reject(new Error('Timeout after ' + ms + 'ms')); })
                        .on('complete', function (result) {
                            if (result instanceof Error) reject(result);
                            else resolve(result);
                        });
                });
            });
    };

    this.getImageTags = function (image, limit) {
        limit = limit || 300;
        var scope = 'repository:' + image + ':pull';
        return self._getToken(scope)
            .then(function (token) {
                return new Promise(function (resolve, reject) {
                    rest.get(self._baseurl + image + '/tags/list?n=' + limit, self.getUrlOptions(1, token))
                        .on('timeout', function (ms) { reject(new Error('Timeout after ' + ms + 'ms')); })
                        .on('complete', function (result) {
                            if (result instanceof Error) reject(result);
                            else resolve(result);
                        });
                });
            });
    };

    this.getManifest = function (image, reference, version) {
        version = version || 2;
        var scope = 'repository:' + image + ':pull';
        return self._getToken(scope)
            .then(function (token) {
                return new Promise(function (resolve, reject) {
                    rest.get(self._baseurl + image + '/manifests/' + reference, self.getUrlOptions(version, token))
                        .on('timeout', function (ms) { reject(new Error('Timeout after ' + ms + 'ms')); })
                        .on('complete', function (result, response) {
                            if (result instanceof Error) { reject(result); return; }
                            if (typeof result === 'string') result = JSON.parse(result);
                            result.digest = response.headers['docker-content-digest'] || null;
                            resolve(result);
                        });
                });
            });
    };

    this.deleteImage = function (image, digest) {
        var scope = 'repository:' + image + ':push,pull,delete';
        return self._getToken(scope)
            .then(function (token) {
                return new Promise(function (resolve, reject) {
                    rest.del(self._baseurl + image + '/manifests/' + digest, self.getUrlOptions(1, token))
                        .on('timeout', function (ms) { reject(new Error('Timeout after ' + ms + 'ms')); })
                        .on('202', function () { resolve(true); })
                        .on('404', function () { resolve(false); })
                        .on('complete', function (result) {
                            if (result instanceof Error) { reject(result); return; }
                            if (result.errors && result.errors.length) resolve(result.errors.shift());
                        });
                });
            });
    };

    this.deleteLayer = function (image, layer_digest) {
        var scope = 'repository:' + image + ':push,pull,delete';
        return self._getToken(scope)
            .then(function (token) {
                return new Promise(function (resolve, reject) {
                    rest.del(self._baseurl + image + '/blobs/' + layer_digest, self.getUrlOptions(1, token))
                        .on('timeout', function (ms) { reject(new Error('Timeout after ' + ms + 'ms')); })
                        .on('202', function () { resolve(true); })
                        .on('404', function () { resolve(false); })
                        .on('complete', function (result) {
                            if (result instanceof Error) { reject(result); return; }
                            if (result.errors && result.errors.length) resolve(result.errors.shift());
                        });
                });
            });
    };

    return this;
};