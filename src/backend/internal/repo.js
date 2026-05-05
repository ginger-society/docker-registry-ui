'use strict';

const REGISTRY_HOST = process.env.REGISTRY_HOST;
const REGISTRY_SSL  = process.env.REGISTRY_SSL && process.env.REGISTRY_SSL.toLowerCase() === 'true' || parseInt(process.env.REGISTRY_SSL, 10) === 1;

const _         = require('lodash');
const Docker    = require('../lib/docker-registry');
const batchflow = require('batchflow');
const errors    = require('../lib/error');
const logger    = require('../logger').registry;

// Extract JWT from Authorization header — supports both Bearer and Basic __token__:<jwt>
function extractToken(authHeader) {
    if (!authHeader) return '';

    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }

    if (authHeader.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const colonIdx = decoded.indexOf(':');
        if (colonIdx !== -1) {
            return decoded.slice(colonIdx + 1).trim(); // everything after __token__:
        }
    }

    return authHeader;
}

// Create a per-request registry client using the caller's token as REGISTRY_PASS
function getRegistry(authHeader) {
    const token = extractToken(authHeader);
    return new Docker(REGISTRY_HOST, REGISTRY_SSL, '__token__', token);
}

const internalRepo = {

    get: (name, full, authHeader) => {
        const registry = getRegistry(authHeader);
        return registry.getImageTags(name)
            .then(tags_data => {
                if (typeof tags_data.errors !== 'undefined' && tags_data.errors.length) {
                    let top_err = tags_data.errors.shift();
                    if (top_err.code === 'NAME_UNKNOWN') {
                        throw new errors.ItemNotFoundError(name);
                    } else {
                        throw new errors.RegistryError(top_err.code, top_err.message);
                    }
                }

                if (full && tags_data.tags !== null) {
                    let latest_idx = tags_data.tags.indexOf('latest');
                    if (latest_idx !== -1) {
                        _.pullAt(tags_data.tags, [latest_idx]);
                    }

                    tags_data.tags = tags_data.tags.sort((a, b) => a.localeCompare(b));

                    if (latest_idx !== -1) {
                        tags_data.tags.unshift('latest');
                    }

                    return new Promise((resolve, reject) => {
                        batchflow(tags_data.tags).sequential()
                            .each((i, tag, next) => {
                                registry.getManifest(tags_data.name, tag, 2)
                                    .then(manifest2_result => {
                                        manifest2_result.name       = tag;
                                        manifest2_result.image_name = name;

                                        return registry.getManifest(tags_data.name, tag, 1)
                                            .then(manifest1_result => {
                                                manifest2_result.info = null;

                                                if (typeof manifest1_result.history !== 'undefined' && manifest1_result.history.length) {
                                                    let info = manifest1_result.history.shift();
                                                    if (typeof info.v1Compatibility !== undefined) {
                                                        info = JSON.parse(info.v1Compatibility);

                                                        if (typeof info.config !== 'undefined') {
                                                            delete info.config;
                                                        }

                                                        if (typeof info.container_config !== 'undefined') {
                                                            delete info.container_config;
                                                        }
                                                    }

                                                    manifest2_result.info = info;
                                                }

                                                next(manifest2_result);
                                            });
                                    })
                                    .catch(err => {
                                        logger.error(err);
                                        next(null);
                                    });
                            })
                            .error(err => {
                                reject(err);
                            })
                            .end(results => {
                                tags_data.tags = results || null;
                                resolve(tags_data);
                            });
                    });
                } else {
                    return tags_data;
                }
            });
    },

    getAll: (with_tags, authHeader) => {
        const registry = getRegistry(authHeader);
        return registry.getImages()
            .then(result => {
                if (typeof result.errors !== 'undefined' && result.errors.length) {
                    let first_err = result.errors.shift();
                    throw new errors.RegistryError(first_err.code, first_err.message);
                } else if (typeof result.repositories !== 'undefined') {
                    let repositories = [];

                    result.repositories = result.repositories.sort((a, b) => a.localeCompare(b));

                    _.map(result.repositories, function (repo) {
                        repositories.push({ name: repo });
                    });

                    return repositories;
                }

                return result;
            })
            .then(images => {
                if (with_tags) {
                    return new Promise((resolve, reject) => {
                        batchflow(images).sequential()
                            .each((i, image, next) => {
                                let image_result = image;
                                registry.getImageTags(image.name)
                                    .then(tags_result => {
                                        if (typeof tags_result === 'string') {
                                            logger.error('Tags result was: ', tags_result);
                                            image_result.tags = null;
                                        } else if (typeof tags_result.tags !== 'undefined' && tags_result.tags !== null) {
                                            let latest_idx = tags_result.tags.indexOf('latest');
                                            if (latest_idx !== -1) {
                                                _.pullAt(tags_result.tags, [latest_idx]);
                                            }

                                            image_result.tags = tags_result.tags.sort((a, b) => a.localeCompare(b));

                                            if (latest_idx !== -1) {
                                                image_result.tags.unshift('latest');
                                            }
                                        }

                                        next(image_result);
                                    })
                                    .catch(err => {
                                        logger.error(err);
                                        image_result.tags = null;
                                        next(image_result);
                                    });
                            })
                            .error(err => { reject(err); })
                            .end(results => { resolve(results); });
                    });
                } else {
                    return images;
                }
            });
    },

    delete: (name, digest, authHeader) => {
        const registry = getRegistry(authHeader);
        return registry.deleteImage(name, digest);
    }
};

module.exports = internalRepo;