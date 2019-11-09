"use strict";
/**
 * Simulator State
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT
 */
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var battle_1 = require("./battle");
var Data = require("./dex-data");
var field_1 = require("./field");
var pokemon_1 = require("./pokemon");
var prng_1 = require("./prng");
var side_1 = require("./side");
// The simulator supports up to 24 different Pokemon on a team. Serialization
// uses letters instead of numbers to indicate indices/positions, but where
// the simulator only gives a position to active Pokemon, serialization
// uses letters for every Pokemon on a team. Active pokemon will still
// have the same letter as their position would indicate, but non-active
// team members are filled in with subsequent letters.
var POSITIONS = 'abcdefghijklmnopqrstuvwx';
// Certain fields are either redundant (transient caches, constants, duplicate
// information) or require special treatment. These sets contain the specific
// keys which we skip during default (de)serialization and (the keys which)
// need special treatment from these sets are then handled manually.
// Battle inherits from Dex, but all of Dex's fields are redundant - we can
// just recreate the Dex from the format.
var BATTLE = new Set([
    'dex', 'gen', 'ruleTable', 'id', 'log', 'inherit', 'format',
    'zMoveTable', 'teamGenerator', 'NOT_FAIL', 'FAIL', 'SILENT_FAIL',
    'field', 'sides', 'prng', 'hints', 'deserialized',
]);
var FIELD = new Set(['id', 'battle']);
var SIDE = new Set(['battle', 'team', 'pokemon', 'choice', 'activeRequest']);
var POKEMON = new Set([
    'side', 'battle', 'set', 'name', 'fullname', 'id', 'species',
    'speciesid', 'happiness', 'level', 'pokeball', 'baseMoveSlots',
]);
var CHOICE = new Set(['switchIns']);
var ACTIVE_MOVE = new Set(['move']);
exports.State = new /** @class */ (function () {
    function class_1() {
    }
    class_1.prototype.serializeBattle = function (battle) {
        var state = /* Battle */ this.serialize(battle, BATTLE, battle);
        state.field = this.serializeField(battle.field);
        state.sides = new Array(battle.sides.length);
        for (var _i = 0, _a = battle.sides.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], side = _b[1];
            state.sides[i] = this.serializeSide(side);
        }
        state.prng = battle.prng.seed;
        state.hints = Array.from(battle.hints);
        // We treat log specially because we only set it back on Battle after everything
        // else has been deserialized to avoid anything accidentally `add`-ing to it.
        state.log = battle.log;
        state.formatid = battle.format.id;
        return state;
    };
    // Deserialization can only really be done on the root Battle object as
    // the leaf nodes like Side or Pokemon contain backreferences to Battle
    // but don't contain the information to fill it in because the cycles in
    // the graph have been serialized as references. Once deserialzized, the
    // Battle can then be restarted (and provided with a `send` function for
    // receiving updates).
    class_1.prototype.deserializeBattle = function (serialized) {
        var state = /* Battle */ typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
        var options = {
            formatid: state.formatid,
            seed: state.prngSeed,
            rated: state.rated,
            debug: state.debugMode,
            // We need to tell the Battle that we're creating that it's been
            // deserialized so that it allows us to populate it correctly and
            // doesn't attempt to start playing out until we're ready.
            deserialized: true,
            strictChoices: state.strictChoices
        };
        var _loop_1 = function (side) {
            // When we instantiate the Battle again we need the pokemon to be in
            // the correct order they were in at the start of the Battle which was
            // serialized. See serializeSide below for an explanation about the
            // encoding format used deserializeSide for where we reorder the Side's
            // pokemon to match their ordering at the point of serialization.
            var team = side.team.split(side.team.length > 9 ? ',' : '');
            // @ts-ignore - index signature
            options[side.id] = {
                name: side.name,
                avatar: side.avatar,
                team: team.map(function (p) { return side.pokemon[Number(p) - 1].set; })
            };
        };
        for (var _i = 0, _a = state.sides; _i < _a.length; _i++) {
            var side = _a[_i];
            _loop_1(side);
        }
        // We create the Battle, allowing it to instantiate the Field/Side/Pokemon
        // objects for us. The objects it creates will be incorrect, but we descend
        // down through the fields and repopulate all of the objects with the
        // correct state afterwards.
        var battle = new battle_1.Battle(options);
        // Calling `new Battle(...)` means side.pokemon is ordered to match what it
        // was at the start of the battle (state.team), but we need to order the Pokemon
        // back in their correct order based on how the battle has progressed. We need
        // do to this before making any deserialization calls so that `fromRef` will
        // be correct.
        for (var _b = 0, _c = state.sides.entries(); _b < _c.length; _b++) {
            var _d = _c[_b], i = _d[0], s = _d[1];
            var side = battle.sides[i];
            var ordered = new Array(side.pokemon.length);
            var team = s.team.split(s.team.length > 9 ? ',' : '');
            for (var _e = 0, _f = team.entries(); _e < _f.length; _e++) {
                var _g = _f[_e], j = _g[0], pos = _g[1];
                ordered[Number(pos) - 1] = side.pokemon[j];
            }
            side.pokemon = ordered;
        }
        this.deserialize(state, battle, BATTLE, battle);
        this.deserializeField(state.field, battle.field);
        var activeRequests = false;
        for (var _h = 0, _j = state.sides.entries(); _h < _j.length; _h++) {
            var _k = _j[_h], i = _k[0], side = _k[1];
            this.deserializeSide(side, battle.sides[i]);
            activeRequests = activeRequests || side.activeRequest === undefined;
        }
        // Since battle.getRequests depends on the state of each side we can't combine
        // this loop with the one above which deserializes the sides. We also only do this
        // if there are any active requests, not only to avoid have to recompute request
        // states we wouldnt be using, but also because battle.getRequests will mutate
        // state on occasion (eg. `pokemon.getMoves` sets `pokemon.trapped = true` if locked).
        if (activeRequests) {
            var requests = battle.getRequests(battle.requestState, battle.getMaxTeamSize());
            for (var _l = 0, _m = state.sides.entries(); _l < _m.length; _l++) {
                var _o = _m[_l], i = _o[0], side = _o[1];
                battle.sides[i].activeRequest = side.activeRequest === null ? null : requests[i];
            }
        }
        battle.prng = new prng_1.PRNG(state.prng);
        // @ts-ignore - readonly
        battle.hints = new Set(state.hints);
        // @ts-ignore - readonly
        battle.log = state.log;
        return battle;
    };
    class_1.prototype.serializeField = function (field) {
        return this.serialize(field, FIELD, field.battle);
    };
    class_1.prototype.deserializeField = function (state, field) {
        this.deserialize(state, field, FIELD, field.battle);
    };
    class_1.prototype.serializeSide = function (side) {
        var state = /* Side */ this.serialize(side, SIDE, side.battle);
        state.pokemon = new Array(side.pokemon.length);
        var team = new Array(side.pokemon.length);
        for (var _i = 0, _a = side.pokemon.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], pokemon = _b[1];
            state.pokemon[i] = this.serializePokemon(pokemon);
            team[side.team.indexOf(pokemon.set)] = i + 1;
        }
        // We encode the team such that it could be used as a valid `/team` command
        // during decoding to transform the current ordering of the serialized Side's
        // pokemon array into the original team ordering at the start of the battle.
        // This is *not* the same as the original `/team` command used to order the
        // pokemon in team preview, but this encoding results in the most intuitive
        // and readable debugging of the raw JSON, so we're willing to add a small
        // amount of complexity to the encoding/decoding process to accommodate this.
        state.team = team.join(team.length > 9 ? ',' : '');
        state.choice = this.serializeChoice(side.choice, side.battle);
        // If activeRequest is null we encode it as a tombstone indicator to ensure
        // that during serialization when we recompute the activeRequest we don't turn
        // `activeRequest = null` into  `activeRequest = { wait: true, ... }`.
        if (side.activeRequest === null)
            state.activeRequest = null;
        return state;
    };
    class_1.prototype.deserializeSide = function (state, side) {
        this.deserialize(state, side, SIDE, side.battle);
        for (var _i = 0, _a = state.pokemon.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], pokemon = _b[1];
            this.deserializePokemon(pokemon, side.pokemon[i]);
        }
        this.deserializeChoice(state.choice, side.choice, side.battle);
    };
    class_1.prototype.serializePokemon = function (pokemon) {
        var state = /* Pokemon */ this.serialize(pokemon, POKEMON, pokemon.battle);
        state.set = pokemon.set;
        // Only serialize the baseMoveSlots if they differ from moveSlots. We could get fancy and
        // only serialize the diff and its index but thats overkill for a pretty niche case anyway.
        if (pokemon.baseMoveSlots.length !== pokemon.moveSlots.length ||
            !pokemon.baseMoveSlots.every(function (ms, i) { return ms === pokemon.moveSlots[i]; })) {
            state.baseMoveSlots = this.serializeWithRefs(pokemon.baseMoveSlots, pokemon.battle);
        }
        return state;
    };
    class_1.prototype.deserializePokemon = function (state, pokemon) {
        this.deserialize(state, pokemon, POKEMON, pokemon.battle);
        // @ts-ignore - readonly
        pokemon.set = state.set;
        // baseMoveSlots and moveSlots need to point to the same objects (ie. identity, not equality).
        // If we serialized the baseMoveSlots, replace any that match moveSlots to preserve the
        // identity relationship requirement.
        var baseMoveSlots;
        if (state.baseMoveSlots) {
            baseMoveSlots = this.deserializeWithRefs(state.baseMoveSlots, pokemon.battle);
            for (var _i = 0, _a = baseMoveSlots.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], i = _b[0], baseMoveSlot = _b[1];
                var moveSlot = pokemon.moveSlots[i];
                if (moveSlot.id === baseMoveSlot.id && !moveSlot.virtual) {
                    baseMoveSlots[i] = moveSlot;
                }
            }
        }
        else {
            baseMoveSlots = pokemon.moveSlots.slice();
        }
        // @ts-ignore - readonly
        pokemon.baseMoveSlots = baseMoveSlots;
        if (state.showCure === undefined)
            pokemon.showCure = undefined;
    };
    class_1.prototype.serializeChoice = function (choice, battle) {
        var state = /* Choice */ this.serialize(choice, CHOICE, battle);
        state.switchIns = Array.from(choice.switchIns);
        return state;
    };
    class_1.prototype.deserializeChoice = function (state, choice, battle) {
        this.deserialize(state, choice, CHOICE, battle);
        choice.switchIns = new Set(state.switchIns);
    };
    // Simply looking for a 'hit' field to determine if an object is an ActiveMove or not seems
    // pretty fragile, but its no different than what the simulator is doing. We go further and
    // also check if the object has an 'id', as that's what we will intrepret as the Move.
    class_1.prototype.isActiveMove = function (obj) {
        return obj.hasOwnProperty('hit') && (obj.hasOwnProperty('id') || obj.hasOwnProperty('move'));
    };
    // ActiveMove is somewhat problematic (#5415) as it sometimes extends a Move and adds on
    // some mutable fields. We'd like to avoid displaying all the readonly fields of Move
    // (which in theory should not be changed by the ActiveMove...), so we collapse them
    // into a 'move: [Move:...]' reference.  If isActiveMove returns a false positive *and*
    // and object contains an 'id' field matching a Move *and* it contains fields with the
    // same name as said Move then we'll miss them during serialization and won't
    // deserialize properly. This is unlikely to be the case, and would probably indicate
    // a bug in the simulator if it ever happened, but if not, the isActiveMove check can
    // be extended.
    class_1.prototype.serializeActiveMove = function (move, battle) {
        var base = battle.dex.getMove(move.id);
        var skip = new Set(__spreadArrays(ACTIVE_MOVE));
        for (var _i = 0, _a = Object.entries(base); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            // This should really be a deepEquals check to see if anything on ActiveMove was
            // modified from the base Move, but that ends up being expensive and mostly unnecessary
            // as ActiveMove currently only mutates its simple fields (eg. `type`, `target`) anyway.
            // @ts-ignore - index signature
            if (typeof value === 'object' || move[key] === value)
                skip.add(key);
        }
        var state = /* ActiveMove */ this.serialize(move, skip, battle);
        state.move = "[Move:" + move.id + "]";
        return state;
    };
    class_1.prototype.deserializeActiveMove = function (state, battle) {
        var move = battle.dex.getActiveMove(this.fromRef(state.move, battle));
        this.deserialize(state, move, ACTIVE_MOVE, battle);
        return move;
    };
    class_1.prototype.serializeWithRefs = function (obj, battle) {
        switch (typeof obj) {
            case 'function':
                return undefined; // elide functions
            case 'undefined':
            case 'boolean':
            case 'number':
            case 'string':
                return obj;
            case 'object':
                if (obj === null)
                    return null;
                if (Array.isArray(obj)) {
                    var arr = new Array(obj.length);
                    for (var _i = 0, _a = obj.entries(); _i < _a.length; _i++) {
                        var _b = _a[_i], i = _b[0], o_1 = _b[1];
                        arr[i] = this.serializeWithRefs(o_1, battle);
                    }
                    return arr;
                }
                if (this.isActiveMove(obj))
                    return this.serializeActiveMove(obj, battle);
                if (this.isReferable(obj))
                    return this.toRef(obj);
                if (obj.constructor !== Object) {
                    // If we're getting this error, some 'special' field has been added to
                    // an object and we need to update the logic in this file to handle it.
                    // The most common case it that someone added a Set/Map which probably
                    // needs to be serialized as an Array/Object respectively - see how
                    // Battle 'hints' or Choice 'switchIns' are handled (and you will likely
                    // need to add the new field to the respective skip constant).
                    throw new TypeError("Unsupported type " + obj.constructor.name + ": " + obj);
                }
                var o = {};
                for (var _c = 0, _d = Object.entries(obj); _c < _d.length; _c++) {
                    var _e = _d[_c], key = _e[0], value = _e[1];
                    o[key] = this.serializeWithRefs(value, battle);
                }
                return o;
            default:
                throw new TypeError("Unexpected typeof === '" + typeof obj + "': " + obj);
        }
    };
    class_1.prototype.deserializeWithRefs = function (obj, battle) {
        switch (typeof obj) {
            case 'undefined':
            case 'boolean':
            case 'number':
                return obj;
            case 'string':
                return this.fromRef(obj, battle) || obj;
            case 'object':
                if (obj === null)
                    return null;
                if (Array.isArray(obj)) {
                    var arr = new Array(obj.length);
                    for (var _i = 0, _a = obj.entries(); _i < _a.length; _i++) {
                        var _b = _a[_i], i = _b[0], o_2 = _b[1];
                        arr[i] = this.deserializeWithRefs(o_2, battle);
                    }
                    return arr;
                }
                if (this.isActiveMove(obj))
                    return this.deserializeActiveMove(obj, battle);
                var o = {};
                for (var _c = 0, _d = Object.entries(obj); _c < _d.length; _c++) {
                    var _e = _d[_c], key = _e[0], value = _e[1];
                    o[key] = this.deserializeWithRefs(value, battle);
                }
                return o;
            case 'function': // lol wtf
            default:
                throw new TypeError("Unexpected typeof === '" + typeof obj + "': " + obj);
        }
    };
    class_1.prototype.isReferable = function (obj) {
        // NOTE: see explanation on the declaration above for why this must be defined lazily.
        if (!this.REFERABLE) {
            this.REFERABLE = new Set([
                battle_1.Battle, field_1.Field, side_1.Side, pokemon_1.Pokemon, Data.PureEffect,
                Data.Ability, Data.Item, Data.Move, Data.Template,
            ]);
        }
        return this.REFERABLE.has(obj.constructor);
    };
    class_1.prototype.toRef = function (obj) {
        // Pokemon's 'id' is not only more verbose than a position, it also isn't guaranteed
        // to be uniquely identifying in custom games without Nickname/Species Clause.
        var id = obj instanceof pokemon_1.Pokemon ? "" + obj.side.id + POSITIONS[obj.position] : "" + obj.id;
        return "[" + obj.constructor.name + (id ? ':' : '') + id + "]";
    };
    class_1.prototype.fromRef = function (ref, battle) {
        // References are sort of fragile - we're mostly just counting on there
        // being a low chance that some string field in a simulator object will not
        // 'look' like one. However, it also needs to match one of the Referable
        // class types to be decode, so we're probably OK. We could make the reference
        // markers more esoteric with additional sigils etc to avoid collisions, but
        // we're making a conscious decision to favor readability over robustness.
        if (ref.charAt(0) !== '[' && ref.slice(-1) !== ']')
            return undefined;
        ref = ref.substring(1, ref.length - 1);
        // There's only one instance of these thus they don't need an id to differentiate.
        if (ref === 'Battle')
            return battle;
        if (ref === 'Field')
            return battle.field;
        var _a = ref.split(':'), type = _a[0], id = _a[1];
        switch (type) {
            case 'Side': return battle.sides[Number(id[1]) - 1];
            case 'Pokemon': return battle.sides[Number(id[1]) - 1].pokemon[POSITIONS.indexOf(id[2])];
            case 'Ability': return battle.dex.getAbility(id);
            case 'Item': return battle.dex.getItem(id);
            case 'Move': return battle.dex.getMove(id);
            case 'PureEffect': return battle.dex.getEffect(id);
            case 'Template': return battle.dex.getTemplate(id);
            default: return undefined; // maybe we actually got unlucky and its a string
        }
    };
    class_1.prototype.serialize = function (obj, skip, battle) {
        var state = {};
        for (var _i = 0, _a = Object.entries(obj); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (skip.has(key))
                continue;
            var val = this.serializeWithRefs(value, battle);
            // JSON.stringify will get rid of keys with undefined values anyway, but
            // we also do it here so that assert.deepStrictEqual works on battle.toJSON().
            if (typeof val !== 'undefined')
                state[key] = val;
        }
        return state;
    };
    class_1.prototype.deserialize = function (state, obj, skip, battle) {
        for (var _i = 0, _a = Object.entries(state); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (skip.has(key))
                continue;
            // @ts-ignore - index signature
            obj[key] = this.deserializeWithRefs(value, battle);
        }
    };
    return class_1;
}());
