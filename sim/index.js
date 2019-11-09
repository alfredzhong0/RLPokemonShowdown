"use strict";
/**
 * Simulator process
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * This file is where the battle simulation itself happens.
 *
 * The most important part of the simulation happens in runEvent -
 * see that function's definition for details.
 *
 * @license MIT
 */
exports.__esModule = true;
var battle_1 = require("./battle");
exports.Battle = battle_1.Battle;
var battle_stream_1 = require("./battle-stream");
exports.BattleStream = battle_stream_1.BattleStream;
var dex_1 = require("./dex");
exports.Dex = dex_1.Dex;
var pokemon_1 = require("./pokemon");
exports.Pokemon = pokemon_1.Pokemon;
var prng_1 = require("./prng");
exports.PRNG = prng_1.PRNG;
var side_1 = require("./side");
exports.Side = side_1.Side;
var team_validator_1 = require("./team-validator");
exports.TeamValidator = team_validator_1.TeamValidator;
