"use strict";
/**
 * Simulator Battle
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT license
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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var Tools = /** @class */ (function () {
    function Tools() {
    }
    /**
     * Safely converts the passed variable into a string. Unlike '' + str,
     * String(str), or str.toString(), Dex.getString is guaranteed not to
     * crash.
     *
     * Specifically, the fear with untrusted JSON is an object like:
     *
     *     let a = {"toString": "this is not a function"};
     *     console.log(`a is ${a}`);
     *
     * This will crash (because a.toString() is not a function). Instead,
     * Dex.getString simply returns '' if the passed variable isn't a
     * string or a number.
     */
    Tools.getString = function (str) {
        return (typeof str === 'string' || typeof str === 'number') ? '' + str : '';
    };
    /**
     * Converts anything to an ID. An ID must have only lowercase alphanumeric
     * characters.
     *
     * If a string is passed, it will be converted to lowercase and
     * non-alphanumeric characters will be stripped.
     *
     * If an object with an ID is passed, its ID will be returned.
     * Otherwise, an empty string will be returned.
     *
     * Dex.getId is generally assigned to the global toID, because of how
     * commonly it's used.
     */
    Tools.getId = function (text) {
        if (text && text.id) {
            text = text.id;
        }
        else if (text && text.userid) {
            text = text.userid;
        }
        else if (text && text.roomid) {
            text = text.roomid;
        }
        if (typeof text !== 'string' && typeof text !== 'number')
            return '';
        return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
    };
    return Tools;
}());
exports.Tools = Tools;
var toID = Tools.getId;
var BasicEffect = /** @class */ (function () {
    function BasicEffect(data) {
        var moreData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            moreData[_i - 1] = arguments[_i];
        }
        this.exists = true;
        data = combine.apply(void 0, __spreadArrays([this, data], moreData));
        this.name = Tools.getString(data.name).trim();
        this.id = data.id || toID(this.name); // Hidden Power hack
        this.fullname = Tools.getString(data.fullname) || this.name;
        this.effectType = Tools.getString(data.effectType) || 'Effect';
        this.exists = !!(this.exists && this.id);
        this.num = data.num || 0;
        this.gen = data.gen || 0;
        this.isUnreleased = data.isUnreleased || false;
        this.shortDesc = data.shortDesc || '';
        this.desc = data.desc || '';
        this.isNonstandard = data.isNonstandard || null;
        this.duration = data.duration;
        this.noCopy = !!data.noCopy;
        this.affectsFainted = !!data.affectsFainted;
        this.status = data.status || undefined;
        this.weather = data.weather || undefined;
        this.sourceEffect = data.sourceEffect || '';
    }
    BasicEffect.prototype.toString = function () {
        return this.name;
    };
    return BasicEffect;
}());
exports.BasicEffect = BasicEffect;
/**
 * A RuleTable keeps track of the rules that a format has. The key can be:
 * - '[ruleid]' the ID of a rule in effect
 * - '-[thing]' or '-[category]:[thing]' ban a thing
 * - '+[thing]' or '+[category]:[thing]' allow a thing (override a ban)
 * [category] is one of: item, move, ability, species, basespecies
 *
 * The value is the name of the parent rule (blank for the active format).
 */
var RuleTable = /** @class */ (function (_super) {
    __extends(RuleTable, _super);
    function RuleTable() {
        var _this = _super.call(this) || this;
        _this.complexBans = [];
        _this.complexTeamBans = [];
        _this.checkLearnset = null;
        _this.timer = null;
        return _this;
    }
    RuleTable.prototype.isBanned = function (thing) {
        if (this.has("+" + thing))
            return false;
        return this.has("-" + thing);
    };
    RuleTable.prototype.check = function (thing, setHas) {
        if (setHas === void 0) { setHas = null; }
        if (this.has("+" + thing))
            return '';
        if (setHas)
            setHas[thing] = true;
        return this.getReason("-" + thing);
    };
    RuleTable.prototype.getReason = function (key) {
        var source = this.get(key);
        if (source === undefined)
            return null;
        if (key === '-nonexistent' || key.startsWith('obtainable')) {
            return 'not obtainable';
        }
        return source ? "banned by " + source : "banned";
    };
    RuleTable.prototype.getComplexBanIndex = function (complexBans, rule) {
        var ruleId = toID(rule);
        var complexBanIndex = -1;
        for (var i = 0; i < complexBans.length; i++) {
            if (toID(complexBans[i][0]) === ruleId) {
                complexBanIndex = i;
                break;
            }
        }
        return complexBanIndex;
    };
    RuleTable.prototype.addComplexBan = function (rule, source, limit, bans) {
        var complexBanIndex = this.getComplexBanIndex(this.complexBans, rule);
        if (complexBanIndex !== -1) {
            if (this.complexBans[complexBanIndex][2] === Infinity)
                return;
            this.complexBans[complexBanIndex] = [rule, source, limit, bans];
        }
        else {
            this.complexBans.push([rule, source, limit, bans]);
        }
    };
    RuleTable.prototype.addComplexTeamBan = function (rule, source, limit, bans) {
        var complexBanTeamIndex = this.getComplexBanIndex(this.complexTeamBans, rule);
        if (complexBanTeamIndex !== -1) {
            if (this.complexTeamBans[complexBanTeamIndex][2] === Infinity)
                return;
            this.complexTeamBans[complexBanTeamIndex] = [rule, source, limit, bans];
        }
        else {
            this.complexTeamBans.push([rule, source, limit, bans]);
        }
    };
    return RuleTable;
}(Map));
exports.RuleTable = RuleTable;
var Format = /** @class */ (function (_super) {
    __extends(Format, _super);
    function Format(data) {
        var moreData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            moreData[_i - 1] = arguments[_i];
        }
        var _this = _super.apply(this, __spreadArrays([data], moreData)) || this;
        data = _this;
        _this.mod = Tools.getString(data.mod) || 'gen7';
        _this.effectType = Tools.getString(data.effectType) || 'Format';
        _this.debug = !!data.debug;
        _this.rated = (data.rated !== false);
        _this.gameType = data.gameType || 'singles';
        _this.ruleset = data.ruleset || [];
        _this.baseRuleset = data.baseRuleset || [];
        _this.banlist = data.banlist || [];
        _this.unbanlist = data.unbanlist || [];
        _this.customRules = data.customRules || null;
        _this.ruleTable = null;
        _this.teamLength = data.teamLength || undefined;
        _this.onBegin = data.onBegin || undefined;
        _this.requirePentagon = !!data.requirePentagon;
        _this.requirePlus = !!data.requirePlus;
        _this.maxLevel = data.maxLevel || 100;
        _this.defaultLevel = data.defaultLevel || _this.maxLevel;
        _this.forcedLevel = data.forcedLevel || undefined;
        _this.maxForcedLevel = data.maxForcedLevel || undefined;
        _this.noLog = !!data.noLog;
        return _this;
    }
    return Format;
}(BasicEffect));
exports.Format = Format;
var PureEffect = /** @class */ (function (_super) {
    __extends(PureEffect, _super);
    function PureEffect(data) {
        var moreData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            moreData[_i - 1] = arguments[_i];
        }
        var _this = _super.apply(this, __spreadArrays([data], moreData)) || this;
        data = _this;
        _this.effectType = (['Weather', 'Status'].includes(data.effectType) ? data.effectType : 'Effect');
        return _this;
    }
    return PureEffect;
}(BasicEffect));
exports.PureEffect = PureEffect;
var Item = /** @class */ (function (_super) {
    __extends(Item, _super);
    function Item(data) {
        var moreData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            moreData[_i - 1] = arguments[_i];
        }
        var _this = _super.apply(this, __spreadArrays([data], moreData)) || this;
        data = _this;
        _this.fullname = "item: " + _this.name;
        _this.effectType = 'Item';
        _this.fling = data.fling || undefined;
        _this.onDrive = data.onDrive || undefined;
        _this.onMemory = data.onMemory || undefined;
        _this.megaStone = data.megaStone || undefined;
        _this.megaEvolves = data.megaEvolves || undefined;
        _this.zMove = data.zMove || undefined;
        _this.zMoveType = data.zMoveType || undefined;
        _this.zMoveFrom = data.zMoveFrom || undefined;
        _this.zMoveUser = data.zMoveUser || undefined;
        _this.isBerry = !!data.isBerry;
        _this.ignoreKlutz = !!data.ignoreKlutz;
        _this.onPlate = data.onPlate || undefined;
        _this.isGem = !!data.isGem;
        _this.isPokeball = !!data.isPokeball;
        if (!_this.gen) {
            if (_this.num >= 689) {
                _this.gen = 7;
            }
            else if (_this.num >= 577) {
                _this.gen = 6;
            }
            else if (_this.num >= 537) {
                _this.gen = 5;
            }
            else if (_this.num >= 377) {
                _this.gen = 4;
            }
            else {
                _this.gen = 3;
            }
            // Due to difference in gen 2 item numbering, gen 2 items must be
            // specified manually
        }
        if (_this.isBerry)
            _this.fling = { basePower: 10 };
        if (_this.id.endsWith('plate'))
            _this.fling = { basePower: 90 };
        if (_this.onDrive)
            _this.fling = { basePower: 70 };
        if (_this.megaStone)
            _this.fling = { basePower: 80 };
        if (_this.onMemory)
            _this.fling = { basePower: 50 };
        return _this;
    }
    return Item;
}(BasicEffect));
exports.Item = Item;
var Ability = /** @class */ (function (_super) {
    __extends(Ability, _super);
    function Ability(data) {
        var moreData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            moreData[_i - 1] = arguments[_i];
        }
        var _this = _super.apply(this, __spreadArrays([data], moreData)) || this;
        data = _this;
        _this.fullname = "ability: " + _this.name;
        _this.effectType = 'Ability';
        _this.suppressWeather = !!data.suppressWeather;
        _this.rating = data.rating;
        if (!_this.gen) {
            if (_this.num >= 192) {
                _this.gen = 7;
            }
            else if (_this.num >= 165) {
                _this.gen = 6;
            }
            else if (_this.num >= 124) {
                _this.gen = 5;
            }
            else if (_this.num >= 77) {
                _this.gen = 4;
            }
            else if (_this.num >= 1) {
                _this.gen = 3;
            }
        }
        return _this;
    }
    return Ability;
}(BasicEffect));
exports.Ability = Ability;
var Template = /** @class */ (function (_super) {
    __extends(Template, _super);
    function Template(data) {
        var moreData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            moreData[_i - 1] = arguments[_i];
        }
        var _this = _super.apply(this, __spreadArrays([data], moreData)) || this;
        data = _this;
        _this.fullname = "pokemon: " + data.name;
        _this.effectType = 'Pokemon';
        _this.speciesid = data.speciesid || _this.id;
        _this.species = data.species || data.name;
        _this.name = data.species;
        _this.baseSpecies = data.baseSpecies || _this.name;
        _this.forme = data.forme || '';
        _this.otherForms = data.otherForms || undefined;
        _this.otherFormes = data.otherFormes || undefined;
        _this.formeLetter = data.formeLetter || '';
        _this.spriteid = data.spriteid ||
            (toID(_this.baseSpecies) + (_this.baseSpecies !== _this.name ? "-" + toID(_this.forme) : ''));
        _this.abilities = data.abilities || { 0: "" };
        _this.types = data.types;
        _this.addedType = data.addedType || undefined;
        _this.prevo = data.prevo || '';
        _this.tier = data.tier || '';
        _this.doublesTier = data.doublesTier || '';
        _this.evos = data.evos || [];
        _this.evoType = data.evoType || undefined;
        _this.evoMove = data.evoMove || undefined;
        _this.evoLevel = data.evoLevel || undefined;
        _this.nfe = !!_this.evos.length;
        _this.eggGroups = data.eggGroups || [];
        _this.gender = data.gender || '';
        _this.genderRatio = data.genderRatio || (_this.gender === 'M' ? { M: 1, F: 0 } :
            _this.gender === 'F' ? { M: 0, F: 1 } :
                _this.gender === 'N' ? { M: 0, F: 0 } :
                    { M: 0.5, F: 0.5 });
        _this.requiredItem = data.requiredItem || undefined;
        _this.requiredItems = _this.requiredItems || (_this.requiredItem ? [_this.requiredItem] : undefined);
        _this.baseStats = data.baseStats;
        _this.weightkg = data.weightkg;
        _this.weighthg = _this.weightkg * 10;
        _this.heightm = data.heightm;
        _this.color = data.color || '';
        _this.unreleasedHidden = !!data.unreleasedHidden;
        _this.maleOnlyHidden = !!data.maleOnlyHidden;
        _this.maxHP = data.maxHP || undefined;
        _this.learnset = data.learnset || undefined;
        _this.eventOnly = !!data.eventOnly;
        _this.eventPokemon = data.eventPokemon || undefined;
        _this.isMega = !!(_this.forme && ['Mega', 'Mega-X', 'Mega-Y'].includes(_this.forme)) || undefined;
        _this.battleOnly = !!data.battleOnly || !!_this.isMega || undefined;
        if (!_this.gen && _this.num >= 1) {
            if (_this.num >= 722 || _this.forme.startsWith('Alola') || _this.forme === 'Starter') {
                _this.gen = 7;
            }
            else if (_this.forme === 'Primal') {
                _this.gen = 6;
                _this.isPrimal = true;
                _this.battleOnly = true;
            }
            else if (_this.num >= 650 || _this.isMega) {
                _this.gen = 6;
            }
            else if (_this.num >= 494) {
                _this.gen = 5;
            }
            else if (_this.num >= 387) {
                _this.gen = 4;
            }
            else if (_this.num >= 252) {
                _this.gen = 3;
            }
            else if (_this.num >= 152) {
                _this.gen = 2;
            }
            else {
                _this.gen = 1;
            }
        }
        return _this;
    }
    return Template;
}(BasicEffect));
exports.Template = Template;
var Move = /** @class */ (function (_super) {
    __extends(Move, _super);
    function Move(data) {
        var moreData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            moreData[_i - 1] = arguments[_i];
        }
        var _this = _super.apply(this, __spreadArrays([data], moreData)) || this;
        data = _this;
        _this.fullname = "move: " + _this.name;
        _this.effectType = 'Move';
        _this.type = Tools.getString(data.type);
        _this.target = Tools.getString(data.target);
        _this.basePower = Number(data.basePower);
        _this.accuracy = data.accuracy;
        _this.critRatio = Number(data.critRatio) || 1;
        _this.baseMoveType = Tools.getString(data.baseMoveType) || _this.type;
        _this.secondary = data.secondary || null;
        _this.secondaries = data.secondaries || (_this.secondary && [_this.secondary]) || null;
        _this.priority = Number(data.priority) || 0;
        _this.category = data.category;
        _this.defensiveCategory = data.defensiveCategory || undefined;
        _this.useTargetOffensive = !!data.useTargetOffensive;
        _this.useSourceDefensive = !!data.useSourceDefensive;
        _this.ignoreNegativeOffensive = !!data.ignoreNegativeOffensive;
        _this.ignorePositiveDefensive = !!data.ignorePositiveDefensive;
        _this.ignoreOffensive = !!data.ignoreOffensive;
        _this.ignoreDefensive = !!data.ignoreDefensive;
        _this.ignoreImmunity = (data.ignoreImmunity !== undefined ? data.ignoreImmunity : _this.category === 'Status');
        _this.pp = Number(data.pp);
        _this.noPPBoosts = !!data.noPPBoosts;
        _this.isZ = data.isZ || false;
        _this.flags = data.flags || {};
        _this.selfSwitch = (typeof data.selfSwitch === 'string' ? data.selfSwitch : data.selfSwitch) || undefined;
        _this.pressureTarget = data.pressureTarget || '';
        _this.nonGhostTarget = data.nonGhostTarget || '';
        _this.ignoreAbility = data.ignoreAbility || false;
        _this.damage = data.damage;
        _this.spreadHit = data.spreadHit || false;
        _this.forceSTAB = !!data.forceSTAB;
        _this.noSketch = !!data.noSketch;
        _this.stab = data.stab || undefined;
        _this.volatileStatus = typeof data.volatileStatus === 'string' ? data.volatileStatus : undefined;
        if (!_this.gen) {
            if (_this.num >= 622) {
                _this.gen = 7;
            }
            else if (_this.num >= 560) {
                _this.gen = 6;
            }
            else if (_this.num >= 468) {
                _this.gen = 5;
            }
            else if (_this.num >= 355) {
                _this.gen = 4;
            }
            else if (_this.num >= 252) {
                _this.gen = 3;
            }
            else if (_this.num >= 166) {
                _this.gen = 2;
            }
            else if (_this.num >= 1) {
                _this.gen = 1;
            }
        }
        return _this;
    }
    return Move;
}(BasicEffect));
exports.Move = Move;
var TypeInfo = /** @class */ (function () {
    function TypeInfo(data) {
        var moreData = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            moreData[_i - 1] = arguments[_i];
        }
        this.exists = true;
        data = combine.apply(void 0, __spreadArrays([this, data], moreData));
        this.id = data.id || '';
        this.name = Tools.getString(data.name).trim();
        this.effectType = Tools.getString(data.effectType) || 'Type';
        this.exists = !!(this.exists && this.id);
        this.gen = data.gen || 0;
        this.damageTaken = data.damageTaken || {};
        this.HPivs = data.HPivs || {};
        this.HPdvs = data.HPdvs || {};
    }
    TypeInfo.prototype.toString = function () {
        return this.name;
    };
    return TypeInfo;
}());
exports.TypeInfo = TypeInfo;
function combine(obj) {
    var data = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        data[_i - 1] = arguments[_i];
    }
    for (var _a = 0, data_1 = data; _a < data_1.length; _a++) {
        var d = data_1[_a];
        if (d)
            Object.assign(obj, d);
    }
    return obj;
}
// export class PokemonSet {
// 	/**
// 	 * The Pokemon's set's nickname, which is identical to its base
// 	 * species if not specified by the player, e.g. "Minior".
// 	 */
// 	name: string;
// 	/**
// 	 * The Pokemon's species, e.g. "Minior-Red".
// 	 * This should always be converted to an id before use.
// 	 */
// 	species: string;
// 	/**
// 	 * The Pokemon's set's item. This can be an id, e.g. "whiteherb"
// 	 * or a full name, e.g. "White Herb".
// 	 * This should always be converted to an id before use.
// 	 */
// 	item: string;
// 	/**
// 	 * The Pokemon's set's ability. This can be an id, e.g. "shieldsdown"
// 	 * or a full name, e.g. "Shields Down".
// 	 * This should always be converted to an id before use.
// 	 */
// 	ability: string;
// 	/**
// 	 * An array of the Pokemon's set's moves. Each move can be an id,
// 	 * e.g. "shellsmash" or a full name, e.g. "Shell Smash"
// 	 * These should always be converted to ids before use.
// 	 */
// 	moves: string[];
// 	/**
// 	 * The Pokemon's set's nature. This can be an id, e.g. "adamant"
// 	 * or a full name, e.g. "Adamant".
// 	 * This should always be converted to an id before use.
// 	 */
// 	nature: string;
// 	/**
// 	 * The Pokemon's set's gender.
// 	 */
// 	gender: GenderName;
// 	/**
// 	 * The Pokemon's set's effort values, used in stat calculation.
// 	 * These must be between 0 and 255, inclusive.
// 	 */
// 	evs: StatsTable;
// 	/**
// 	 * The Pokemon's individual values, used in stat calculation.
// 	 * These must be between 0 and 31, inclusive.
// 	 * These are also used as DVs, or determinant values, in Gens
// 	 * 1 and 2, which are represented as even numbers from 0 to 30.
// 	 * From Gen 2 and on, IVs/DVs are used to determine Hidden Power's
// 	 * type, although in Gen 7 a Pokemon may be legally altered such
// 	 * that its stats are calculated as if these values were 31 via
// 	 * Bottlecaps. Currently, PS handles this by considering any
// 	 * IV of 31 in Gen 7 to count as either even or odd for the purpose
// 	 * of validating a Hidden Power type, though restrictions on
// 	 * possible IVs for event-only Pokemon are still considered.
// 	 */
// 	ivs: StatsTable;
// 	/**
// 	 * The Pokemon's level. This is usually between 1 and 100, inclusive,
// 	 * but the simulator supports levels up to 9999 for testing purposes.
// 	 */
// 	level: number;
// 	/**
// 	 * Whether the Pokemon is shiny or not. While having no direct
// 	 * competitive effect except in a few OMs, certain Pokemon cannot
// 	 * be legally obtained as shiny, either as a whole or with certain
// 	 * event-only abilities or moves.
// 	 */
// 	shiny?: boolean;
// 	/**
// 	 * The Pokemon's set's happiness value. This is used only for
// 	 * calculating the base power of the moves Return and Frustration.
// 	 * This value must be between 0 and 255, inclusive.
// 	 */
// 	happiness: number;
// 	/**
// 	 * The Pokemon's set's Hidden Power type. This value is intended
// 	 * to be used to manually set a set's HP type in Gen 7 where
// 	 * its IVs do not necessarily reflect the user's intended type.
// 	 * TODO: actually support this in the teambuilder.
// 	 */
// 	hpType?: string;
// 	/**
// 	 * The pokeball this Pokemon is in. Like shininess, this property
// 	 * has no direct competitive effects, but has implications for
// 	 * event legality. For example, any Rayquaza that knows V-Create
// 	 * must be sent out from a Cherish Ball.
// 	 * TODO: actually support this in the validator, switching animations,
// 	 * and the teambuilder.
// 	 */
// 	pokeball?: string;
//
// 	constructor(data: Partial<PokemonSet>) {
// 		this.name = '';
// 		this.species = '';
// 		this.item = '';
// 		this.ability = 'noability';
// 		this.moves = [];
// 		this.nature = '';
// 		this.gender = '';
// 		this.evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
// 		this.ivs = {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31};
// 		this.level = 100;
// 		this.shiny = undefined;
// 		this.happiness = 255; // :)
// 		this.hpType = undefined;
// 		this.pokeball = undefined;
// 		Object.assign(this, data);
// 	}
// }
