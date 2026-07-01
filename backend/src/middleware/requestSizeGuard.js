/**
 * requestSizeGuard.js — Per-route JSON body size limiters.
 *
 * Usage:
 *   const { smallJsonGuard } = require('../middleware/requestSizeGuard');
 *   router.put('/item', smallJsonGuard, upsertProject);
 */

const express = require('express');

/**
 * Limits the parsed JSON body to 2 MB.
 * Suitable for single-project upserts now that images are stored externally.
 */
const smallJsonGuard = express.json({ limit: '2mb' });

module.exports = { smallJsonGuard };
