"use strict";Object.defineProperty(exports, "__esModule", {value: true});/**
 * Config loader
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT
 */

var _configexample = require('../config/config-example'); var defaults = _configexample;

const CONFIG_PATH = require.resolve('../config/config');

 function load(invalidate = false) {
	if (invalidate) delete require.cache[CONFIG_PATH];
	const config = Object.assign({}, defaults, require('../config/config'));
	// config.routes is nested - we need to ensure values are set for its keys as well.
	const routes = config.routes;
	for (const [key, value] of Object.entries(defaults.routes)) {
		if (!(key in routes)) routes[key] = value;
	}
	return config;
} exports.load = load;

 const Config = load(); exports.Config = Config;
