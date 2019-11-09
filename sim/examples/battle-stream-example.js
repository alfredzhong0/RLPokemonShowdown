"use strict";
/**
 * Battle Stream Example
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * Example of how to create AIs battling against each other.
 * Run this using `node build && node .sim-dist/examples/battle-stream-example`.
 *
 * @license MIT
 * @author Guangcong Luo <guangcongluo@gmail.com>
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var battle_stream_1 = require("../battle-stream");
var dex_1 = require("../dex");
var random_player_ai_1 = require("../tools/random-player-ai");
/*********************************************************************
 * Run AI
 *********************************************************************/
// tslint:disable:no-floating-promises
var streams = battle_stream_1.getPlayerStreams(new battle_stream_1.BattleStream());
var spec = {
    formatid: "gen7customgame"
};
var p1spec = {
    name: "Bot 1",
    team: dex_1.Dex.packTeam(dex_1.Dex.generateTeam('gen7randombattle'))
};
var p2spec = {
    name: "Bot 2",
    team: dex_1.Dex.packTeam(dex_1.Dex.generateTeam('gen7randombattle'))
};
var p1 = new random_player_ai_1.RandomPlayerAI(streams.p1);
var p2 = new random_player_ai_1.RandomPlayerAI(streams.p2);
console.log("p1 is " + p1.constructor.name);
console.log("p2 is " + p2.constructor.name);
p1.start();
p2.start();
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var chunk;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, streams.omniscient.read()];
            case 1:
                if (!(chunk = _a.sent())) return [3 /*break*/, 2];
                console.log(chunk);
                return [3 /*break*/, 0];
            case 2: return [2 /*return*/];
        }
    });
}); })();
streams.omniscient.write(">start " + JSON.stringify(spec) + "\n>player p1 " + JSON.stringify(p1spec) + "\n>player p2 " + JSON.stringify(p2spec));
