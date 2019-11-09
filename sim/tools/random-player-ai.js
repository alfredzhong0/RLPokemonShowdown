"use strict";
/**
 * Example random player AI.
 *
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var battle_stream_1 = require("../battle-stream");
var prng_1 = require("../prng");
var RandomPlayerAI = /** @class */ (function (_super) {
    __extends(RandomPlayerAI, _super);
    function RandomPlayerAI(playerStream, options, debug) {
        if (options === void 0) { options = {}; }
        if (debug === void 0) { debug = false; }
        var _this = _super.call(this, playerStream, debug) || this;
        _this.move = options.move || 1.0;
        _this.mega = options.mega || 0;
        _this.prng = options.seed && !Array.isArray(options.seed) ? options.seed : new prng_1.PRNG(options.seed);
        return _this;
    }
    RandomPlayerAI.prototype.receiveError = function (error) {
        // If we made an unavailable choice we will receive a followup request to
        // allow us the opportunity to correct our decision.
        if (error.message.startsWith('[Unavailable choice]'))
            return;
        throw error;
    };
    RandomPlayerAI.prototype.receiveRequest = function (request) {
        var _this = this;
        if (request.wait) {
            // wait request
            // do nothing
        }
        else if (request.forceSwitch) {
            // switch request
            var pokemon_1 = request.side.pokemon;
            var chosen_1 = [];
            var choices = request.forceSwitch.map(function (mustSwitch) {
                if (!mustSwitch)
                    return "pass";
                var canSwitch = [1, 2, 3, 4, 5, 6].filter(function (i) { return (pokemon_1[i - 1] &&
                    // not active
                    i > request.forceSwitch.length &&
                    // not chosen for a simultaneous switch
                    !chosen_1.includes(i) &&
                    // not fainted
                    !pokemon_1[i - 1].condition.endsWith(" fnt")); });
                if (!canSwitch.length)
                    return "pass";
                var target = _this.chooseSwitch(canSwitch.map(function (slot) { return ({ slot: slot, pokemon: pokemon_1[slot - 1] }); }));
                chosen_1.push(target);
                return "switch " + target;
            });
            this.choose(choices.join(", "));
        }
        else if (request.active) {
            // move request
            var _a = [true, true, true], canMegaEvo_1 = _a[0], canUltraBurst_1 = _a[1], canZMove_1 = _a[2];
            var pokemon_2 = request.side.pokemon;
            var chosen_2 = [];
            var choices = request.active.map(function (active, i) {
                if (pokemon_2[i].condition.endsWith(" fnt"))
                    return "pass";
                canMegaEvo_1 = canMegaEvo_1 && active.canMegaEvo;
                canUltraBurst_1 = canUltraBurst_1 && active.canUltraBurst;
                canZMove_1 = canZMove_1 && !!active.canZMove;
                var canMove = [1, 2, 3, 4].slice(0, active.moves.length).filter(function (j) { return (
                // not disabled
                !active.moves[j - 1].disabled
                // NOTE: we don't actually check for whether we have PP or not because the
                // simulator will mark the move as disabled if there is zero PP and there are
                // situations where we actually need to use a move with 0 PP (Gen 1 Wrap).
                ); }).map(function (j) { return ({
                    slot: j,
                    move: active.moves[j - 1].move,
                    target: active.moves[j - 1].target,
                    zMove: false
                }); });
                if (canZMove_1) {
                    canMove.push.apply(canMove, [1, 2, 3, 4].slice(0, active.canZMove.length)
                        .filter(function (j) { return active.canZMove[j - 1]; })
                        .map(function (j) { return ({
                        slot: j,
                        move: active.canZMove[j - 1].move,
                        target: active.canZMove[j - 1].target,
                        zMove: true
                    }); }));
                }
                // Filter out adjacentAlly moves if we have no allies left, unless they're our
                // only possible move options.
                var hasAlly = !pokemon_2[i ^ 1].condition.endsWith(" fnt");
                var filtered = canMove.filter(function (m) { return m.target !== "adjacentAlly" || hasAlly; });
                canMove = filtered.length ? filtered : canMove;
                var moves = canMove.map(function (m) {
                    var move = "move " + m.slot;
                    // NOTE: We don't generate all possible targeting combinations.
                    if (request.active.length > 1) {
                        if (["normal", "any", "adjacentFoe"].includes(m.target)) {
                            move += " " + (1 + Math.floor(_this.prng.next() * 2));
                        }
                        if (m.target === "adjacentAlly") {
                            move += " -" + ((i ^ 1) + 1);
                        }
                        if (m.target === "adjacentAllyOrSelf") {
                            if (hasAlly) {
                                move += " -" + (1 + Math.floor(_this.prng.next() * 2));
                            }
                            else {
                                move += " -" + (i + 1);
                            }
                        }
                    }
                    if (m.zMove)
                        move += " zmove";
                    return { choice: move, move: m };
                });
                var canSwitch = [1, 2, 3, 4, 5, 6].filter(function (j) { return (pokemon_2[j - 1] &&
                    // not active
                    !pokemon_2[j - 1].active &&
                    // not chosen for a simultaneous switch
                    !chosen_2.includes(j) &&
                    // not fainted
                    !pokemon_2[j - 1].condition.endsWith(" fnt")); });
                var switches = active.trapped ? [] : canSwitch;
                if (switches.length && (!moves.length || _this.prng.next() > _this.move)) {
                    var target = _this.chooseSwitch(canSwitch.map(function (slot) { return ({ slot: slot, pokemon: pokemon_2[slot - 1] }); }));
                    chosen_2.push(target);
                    return "switch " + target;
                }
                else if (moves.length) {
                    var move = _this.chooseMove(moves);
                    if (move.endsWith(" zmove")) {
                        canZMove_1 = false;
                        return move;
                    }
                    else if ((canMegaEvo_1 || canUltraBurst_1) && _this.prng.next() < _this.mega) {
                        if (canMegaEvo_1) {
                            canMegaEvo_1 = false;
                            return move + " mega";
                        }
                        else {
                            canUltraBurst_1 = false;
                            return move + " ultra";
                        }
                    }
                    else {
                        return move;
                    }
                }
                else {
                    throw new Error(_this.constructor.name + " unable to make choice " + i + ". request='" + request + "'," +
                        (" chosen='" + chosen_2 + "', (mega=" + canMegaEvo_1 + ", ultra=" + canUltraBurst_1 + ", zmove=" + canZMove_1 + ")"));
                }
            });
            this.choose(choices.join(", "));
        }
        else {
            // team preview?
            this.choose(this.chooseTeamPreview(request.side.pokemon));
        }
    };
    RandomPlayerAI.prototype.chooseTeamPreview = function (team) {
        return "default";
    };
    RandomPlayerAI.prototype.chooseMove = function (moves) {
        return this.prng.sample(moves).choice;
    };
    RandomPlayerAI.prototype.chooseSwitch = function (switches) {
        return this.prng.sample(switches).slot;
    };
    return RandomPlayerAI;
}(battle_stream_1.BattlePlayer));
exports.RandomPlayerAI = RandomPlayerAI;
