"use strict";
/**
 * Battle Stream
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * Supports interacting with a PS battle in Stream format.
 *
 * This format is VERY NOT FINALIZED, please do not use it directly yet.
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
var Streams = require("./../lib/streams");
var battle_1 = require("./battle");
/**
 * Like string.split(delimiter), but only recognizes the first `limit`
 * delimiters (default 1).
 *
 * `"1 2 3 4".split(" ", 2) => ["1", "2"]`
 *
 * `Chat.splitFirst("1 2 3 4", " ", 1) => ["1", "2 3 4"]`
 *
 * Returns an array of length exactly limit + 1.
 */
function splitFirst(str, delimiter, limit) {
    if (limit === void 0) { limit = 1; }
    var splitStr = [];
    while (splitStr.length < limit) {
        var delimiterIndex = str.indexOf(delimiter);
        if (delimiterIndex >= 0) {
            splitStr.push(str.slice(0, delimiterIndex));
            str = str.slice(delimiterIndex + delimiter.length);
        }
        else {
            splitStr.push(str);
            str = '';
        }
    }
    splitStr.push(str);
    return splitStr;
}
var BattleStream = /** @class */ (function (_super) {
    __extends(BattleStream, _super);
    function BattleStream(options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        _this.debug = !!options.debug;
        _this.keepAlive = !!options.keepAlive;
        _this.battle = null;
        return _this;
    }
    BattleStream.prototype._write = function (chunk) {
        try {
            this._writeLines(chunk);
        }
        catch (err) {
            this.pushError(err);
            return;
        }
        if (this.battle)
            this.battle.sendUpdates();
    };
    BattleStream.prototype._writeLines = function (chunk) {
        for (var _i = 0, _a = chunk.split('\n'); _i < _a.length; _i++) {
            var line = _a[_i];
            if (line.charAt(0) === '>') {
                var _b = splitFirst(line.slice(1), ' '), type = _b[0], message = _b[1];
                this._writeLine(type, message);
            }
        }
    };
    BattleStream.prototype._writeLine = function (type, message) {
        var _this = this;
        switch (type) {
            case 'start':
                var options = JSON.parse(message);
                options.send = function (t, data) {
                    if (Array.isArray(data))
                        data = data.join("\n");
                    _this.push(t + "\n" + data);
                    if (t === 'end' && !_this.keepAlive)
                        _this.push(null);
                };
                if (this.debug)
                    options.debug = true;
                this.battle = new battle_1.Battle(options);
                break;
            case 'player':
                var _a = splitFirst(message, ' '), slot = _a[0], optionsText = _a[1];
                this.battle.setPlayer(slot, JSON.parse(optionsText));
                break;
            case 'p1':
            case 'p2':
            case 'p3':
            case 'p4':
                if (message === 'undo') {
                    this.battle.undoChoice(type);
                }
                else {
                    this.battle.choose(type, message);
                }
                break;
            case 'forcewin':
            case 'forcetie':
                this.battle.win(type === 'forcewin' ? message : null);
                break;
            case 'tiebreak':
                this.battle.tiebreak();
                break;
        }
    };
    BattleStream.prototype._end = function () {
        // this is in theory synchronous...
        this.push(null);
        this._destroy();
    };
    BattleStream.prototype._destroy = function () {
        if (this.battle)
            this.battle.destroy();
    };
    return BattleStream;
}(Streams.ObjectReadWriteStream));
exports.BattleStream = BattleStream;
/**
 * Splits a BattleStream into omniscient, spectator, p1, p2, p3 and p4
 * streams, for ease of consumption.
 */
function getPlayerStreams(stream) {
    var _this = this;
    var streams = {
        omniscient: new Streams.ObjectReadWriteStream({
            write: function (data) {
                stream.write(data);
            },
            end: function () {
                return stream.end();
            }
        }),
        spectator: new Streams.ObjectReadStream({
            read: function () { }
        }),
        p1: new Streams.ObjectReadWriteStream({
            write: function (data) {
                stream.write(data.replace(/(^|\n)/g, "$1>p1 "));
            }
        }),
        p2: new Streams.ObjectReadWriteStream({
            write: function (data) {
                stream.write(data.replace(/(^|\n)/g, "$1>p2 "));
            }
        }),
        p3: new Streams.ObjectReadWriteStream({
            write: function (data) {
                stream.write(data.replace(/(^|\n)/g, "$1>p3 "));
            }
        }),
        p4: new Streams.ObjectReadWriteStream({
            write: function (data) {
                stream.write(data.replace(/(^|\n)/g, "$1>p4 "));
            }
        })
    };
    (function () { return __awaiter(_this, void 0, void 0, function () {
        var chunk, _a, type, data, _b, side, sideData, _i, _c, s;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, stream.read()];
                case 1:
                    if (!(chunk = _d.sent())) return [3 /*break*/, 2];
                    _a = splitFirst(chunk, "\n"), type = _a[0], data = _a[1];
                    switch (type) {
                        case 'update':
                            streams.omniscient.push(battle_1.Battle.extractUpdateForSide(data, 'omniscient'));
                            streams.spectator.push(battle_1.Battle.extractUpdateForSide(data, 'spectator'));
                            streams.p1.push(battle_1.Battle.extractUpdateForSide(data, 'p1'));
                            streams.p2.push(battle_1.Battle.extractUpdateForSide(data, 'p2'));
                            streams.p3.push(battle_1.Battle.extractUpdateForSide(data, 'p3'));
                            streams.p4.push(battle_1.Battle.extractUpdateForSide(data, 'p4'));
                            break;
                        case 'sideupdate':
                            _b = splitFirst(data, "\n"), side = _b[0], sideData = _b[1];
                            streams[side].push(sideData);
                            break;
                        case 'end':
                            // ignore
                            break;
                    }
                    return [3 /*break*/, 0];
                case 2:
                    for (_i = 0, _c = Object.values(streams); _i < _c.length; _i++) {
                        s = _c[_i];
                        s.push(null);
                    }
                    return [2 /*return*/];
            }
        });
    }); })()["catch"](function (err) {
        for (var _i = 0, _a = Object.values(streams); _i < _a.length; _i++) {
            var s = _a[_i];
            s.pushError(err);
        }
    });
    return streams;
}
exports.getPlayerStreams = getPlayerStreams;
var BattlePlayer = /** @class */ (function () {
    function BattlePlayer(playerStream, debug) {
        if (debug === void 0) { debug = false; }
        this.stream = playerStream;
        this.log = [];
        this.debug = debug;
    }
    BattlePlayer.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var chunk;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.stream.read()];
                    case 1:
                        if (!(chunk = _a.sent())) return [3 /*break*/, 2];
                        this.receive(chunk);
                        return [3 /*break*/, 0];
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    BattlePlayer.prototype.receive = function (chunk) {
        for (var _i = 0, _a = chunk.split('\n'); _i < _a.length; _i++) {
            var line = _a[_i];
            this.receiveLine(line);
        }
    };
    BattlePlayer.prototype.receiveLine = function (line) {
        if (this.debug)
            console.log(line);
        if (line.charAt(0) !== '|')
            return;
        var _a = splitFirst(line.slice(1), '|'), cmd = _a[0], rest = _a[1];
        if (cmd === 'request')
            return this.receiveRequest(JSON.parse(rest));
        if (cmd === 'error')
            return this.receiveError(new Error(rest));
        this.log.push(line);
    };
    BattlePlayer.prototype.receiveError = function (error) {
        throw error;
    };
    BattlePlayer.prototype.choose = function (choice) {
        this.stream.write(choice);
    };
    return BattlePlayer;
}());
exports.BattlePlayer = BattlePlayer;
var BattleTextStream = /** @class */ (function (_super) {
    __extends(BattleTextStream, _super);
    function BattleTextStream(options) {
        var _this = _super.call(this) || this;
        _this.battleStream = new BattleStream(options);
        _this.currentMessage = '';
        return _this;
    }
    BattleTextStream.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.battleStream.read()];
                    case 1:
                        if (!(message = _a.sent())) return [3 /*break*/, 2];
                        if (!message.endsWith('\n'))
                            message += '\n';
                        this.push(message + '\n');
                        return [3 /*break*/, 0];
                    case 2:
                        this.push(null);
                        return [2 /*return*/];
                }
            });
        });
    };
    BattleTextStream.prototype._write = function (message) {
        this.currentMessage += '' + message;
        var index = this.currentMessage.lastIndexOf('\n');
        if (index >= 0) {
            this.battleStream.write(this.currentMessage.slice(0, index));
            this.currentMessage = this.currentMessage.slice(index + 1);
        }
    };
    BattleTextStream.prototype._end = function () {
        return this.battleStream.end();
    };
    return BattleTextStream;
}(Streams.ReadWriteStream));
exports.BattleTextStream = BattleTextStream;
