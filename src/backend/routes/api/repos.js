'use strict';

const express      = require('express');
const validator    = require('../../lib/validator');
const pagination   = require('../../lib/express/pagination');
const internalRepo = require('../../internal/repo');

let router = express.Router({
    caseSensitive: true,
    strict:        true,
    mergeParams:   true
});

/**
 * /api/repos
 */
router
    .route('/')
    .options((req, res) => {
        res.sendStatus(204);
    })
    .get(pagination('name', 0, 50, 300), (req, res, next) => {
        const authHeader = req.headers['authorization'] || '';

        validator({
            additionalProperties: false,
            properties: {
                tags: {
                    type: 'boolean'
                }
            }
        }, {
            tags: (typeof req.query.tags !== 'undefined' ? !!req.query.tags : false)
        })
            .then(data => {
                return internalRepo.getAll(data.tags, authHeader);
            })
            .then(repos => {
                res.status(200).send(repos);
            })
            .catch(next);
    });

router
    .route('/:name([-a-zA-Z0-9/.,_]+)')
    .options((req, res) => {
        res.sendStatus(204);
    })
    .get((req, res, next) => {
        const authHeader = req.headers['authorization'] || '';

        validator({
            required:             ['name'],
            additionalProperties: false,
            properties: {
                name: {
                    type:      'string',
                    minLength: 1
                },
                full: {
                    type: 'boolean'
                }
            }
        }, {
            name: req.params.name,
            full: (typeof req.query.full !== 'undefined' ? !!req.query.full : false)
        })
            .then(data => {
                return internalRepo.get(data.name, data.full, authHeader);
            })
            .then(repo => {
                res.status(200).send(repo);
            })
            .catch(next);
    })
    .delete((req, res, next) => {
        const authHeader = req.headers['authorization'] || '';

        validator({
            required:             ['name', 'digest'],
            additionalProperties: false,
            properties: {
                name: {
                    type:      'string',
                    minLength: 1
                },
                digest: {
                    type:      'string',
                    minLength: 1
                }
            }
        }, {
            name:   req.params.name,
            digest: (typeof req.query.digest !== 'undefined' ? req.query.digest : '')
        })
            .then(data => {
                return internalRepo.delete(data.name, data.digest, authHeader);
            })
            .then(result => {
                res.status(200).send(result);
            })
            .catch(next);
    });

module.exports = router;