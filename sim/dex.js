"use strict";
/**
 * Dex
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * Handles getting data about pokemon, items, etc. Also contains some useful
 * helper functions for using dex data.
 *
 * By default, nothing is loaded until you call Dex.mod(mod) or
 * Dex.forFormat(format).
 *
 * You may choose to preload some things:
 * - Dex.includeMods() ~10ms
 *   This will populate Dex.dexes, giving you a list of possible mods.
 *   Note that you don't need this for Dex.mod, Dex.mod will
 *   automatically populate this.
 * - Dex.includeFormats() ~30ms
 *   As above, but will also populate Dex.formats, giving an object
 *   containing formats.
 * - Dex.includeData() ~500ms
 *   As above, but will also preload all of Dex.data, giving access to
 *   the data access functions like Dex.getTemplate, Dex.getMove, etc.
 * - Dex.includeModData() ~1500ms
 *   As above, but will also preload Dex.dexes[...].data for all mods.
 *
 * Note that preloading is only necessary for iterating Dex.dexes. Getters
 * like Dex.getTemplate will automatically load this data as needed.
 *
 * @license MIT license
 */
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
Object.defineProperty(Array.prototype, 'flatMap', {
    value: function (callback, thisArg) {
        var newArray = [];
        for (var i = 0; i < this.length; i++) {
            newArray.push.apply(newArray, callback.call(thisArg, this[i], i, this));
        }
        return newArray;
    },
    configurable: true,
    writable: true
});
var fs = require("fs");
var path = require("path");
var Data = require("./dex-data");
var DATA_DIR = path.resolve(__dirname, '../data');
var MODS_DIR = path.resolve(__dirname, '../data/mods');
var FORMATS = path.resolve(__dirname, '../config/formats');
var dexes = Object.create(null);
var DATA_TYPES = [
    'Abilities', 'Formats', 'FormatsData', 'Items', 'Learnsets', 'Movedex',
    'Natures', 'Pokedex', 'Scripts', 'Statuses', 'TypeChart',
];
var DATA_FILES = {
    Abilities: 'abilities',
    Aliases: 'aliases',
    Formats: 'rulesets',
    FormatsData: 'formats-data',
    Items: 'items',
    Learnsets: 'learnsets',
    Movedex: 'moves',
    Natures: 'natures',
    Pokedex: 'pokedex',
    Scripts: 'scripts',
    Statuses: 'statuses',
    TypeChart: 'typechart'
};
var nullEffect = new Data.PureEffect({ name: '', exists: false });
var BattleNatures = {
    adamant: { name: "Adamant", plus: 'atk', minus: 'spa' },
    bashful: { name: "Bashful" },
    bold: { name: "Bold", plus: 'def', minus: 'atk' },
    brave: { name: "Brave", plus: 'atk', minus: 'spe' },
    calm: { name: "Calm", plus: 'spd', minus: 'atk' },
    careful: { name: "Careful", plus: 'spd', minus: 'spa' },
    docile: { name: "Docile" },
    gentle: { name: "Gentle", plus: 'spd', minus: 'def' },
    hardy: { name: "Hardy" },
    hasty: { name: "Hasty", plus: 'spe', minus: 'def' },
    impish: { name: "Impish", plus: 'def', minus: 'spa' },
    jolly: { name: "Jolly", plus: 'spe', minus: 'spa' },
    lax: { name: "Lax", plus: 'def', minus: 'spd' },
    lonely: { name: "Lonely", plus: 'atk', minus: 'def' },
    mild: { name: "Mild", plus: 'spa', minus: 'def' },
    modest: { name: "Modest", plus: 'spa', minus: 'atk' },
    naive: { name: "Naive", plus: 'spe', minus: 'spd' },
    naughty: { name: "Naughty", plus: 'atk', minus: 'spd' },
    quiet: { name: "Quiet", plus: 'spa', minus: 'spe' },
    quirky: { name: "Quirky" },
    rash: { name: "Rash", plus: 'spa', minus: 'spd' },
    relaxed: { name: "Relaxed", plus: 'def', minus: 'spe' },
    sassy: { name: "Sassy", plus: 'spd', minus: 'spe' },
    serious: { name: "Serious" },
    timid: { name: "Timid", plus: 'spe', minus: 'atk' }
};
var toID = Data.Tools.getId;
var ModdedDex = /** @class */ (function () {
    function ModdedDex(mod, isOriginal) {
        if (mod === void 0) { mod = 'base'; }
        if (isOriginal === void 0) { isOriginal = false; }
        this.ModdedDex = ModdedDex;
        this.Data = Data;
        this.name = "[ModdedDex]";
        this.isBase = (mod === 'base');
        this.currentMod = mod;
        this.getId = Data.Tools.getId;
        this.getString = Data.Tools.getString;
        this.abilityCache = new Map();
        this.effectCache = new Map();
        this.itemCache = new Map();
        this.moveCache = new Map();
        this.templateCache = new Map();
        this.typeCache = new Map();
        this.gen = 0;
        this.parentMod = '';
        this.modsLoaded = false;
        this.dataCache = null;
        this.formatsCache = null;
        if (!isOriginal) {
            var original = dexes['base'].mod(mod).includeData();
            this.currentMod = original.currentMod;
            this.gen = original.gen;
            this.parentMod = original.parentMod;
            this.abilityCache = original.abilityCache;
            this.itemCache = original.itemCache;
            this.moveCache = original.moveCache;
            this.templateCache = original.templateCache;
            this.dataCache = original.dataCache;
            this.formatsCache = original.formatsCache;
        }
    }
    Object.defineProperty(ModdedDex.prototype, "dataDir", {
        get: function () {
            return (this.isBase ? DATA_DIR : MODS_DIR + '/' + this.currentMod);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ModdedDex.prototype, "data", {
        get: function () {
            return this.loadData();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ModdedDex.prototype, "formats", {
        get: function () {
            this.includeFormats();
            return this.formatsCache;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ModdedDex.prototype, "dexes", {
        get: function () {
            this.includeMods();
            return dexes;
        },
        enumerable: true,
        configurable: true
    });
    ModdedDex.prototype.mod = function (mod) {
        if (!dexes['base'].modsLoaded)
            dexes['base'].includeMods();
        return dexes[mod || 'base'];
    };
    ModdedDex.prototype.forFormat = function (format) {
        if (!this.modsLoaded)
            this.includeMods();
        var mod = this.getFormat(format).mod;
        return dexes[mod || 'gen7'];
    };
    ModdedDex.prototype.modData = function (dataType, id) {
        if (this.isBase)
            return this.data[dataType][id];
        if (this.data[dataType][id] !== dexes[this.parentMod].data[dataType][id])
            return this.data[dataType][id];
        return (this.data[dataType][id] = this.deepClone(this.data[dataType][id]));
    };
    ModdedDex.prototype.effectToString = function () {
        return this.name;
    };
    /**
     * Sanitizes a username or Pokemon nickname
     *
     * Returns the passed name, sanitized for safe use as a name in the PS
     * protocol.
     *
     * Such a string must uphold these guarantees:
     * - must not contain any ASCII whitespace character other than a space
     * - must not start or end with a space character
     * - must not contain any of: | , [ ]
     * - must not be the empty string
     * - must not contain Unicode RTL control characters
     *
     * If no such string can be found, returns the empty string. Calling
     * functions are expected to check for that condition and deal with it
     * accordingly.
     *
     * getName also enforces that there are not multiple consecutive space
     * characters in the name, although this is not strictly necessary for
     * safety.
     */
    ModdedDex.prototype.getName = function (name) {
        if (typeof name !== 'string' && typeof name !== 'number')
            return '';
        name = ('' + name).replace(/[|\s[\],\u202e]+/g, ' ').trim();
        if (name.length > 18)
            name = name.substr(0, 18).trim();
        // remove zalgo
        name = name.replace(/[\u0300-\u036f\u0483-\u0489\u0610-\u0615\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]{3,}/g, '');
        name = name.replace(/[\u239b-\u23b9]/g, '');
        return name;
    };
    /**
     * Returns false if the target is immune; true otherwise.
     * Also checks immunity to some statuses.
     */
    ModdedDex.prototype.getImmunity = function (source, target) {
        var sourceType = typeof source !== 'string' ? source.type : source;
        // @ts-ignore
        var targetTyping = target.getTypes && target.getTypes() || target.types || target;
        if (Array.isArray(targetTyping)) {
            for (var _i = 0, targetTyping_1 = targetTyping; _i < targetTyping_1.length; _i++) {
                var type = targetTyping_1[_i];
                if (!this.getImmunity(sourceType, type))
                    return false;
            }
            return true;
        }
        var typeData = this.data.TypeChart[targetTyping];
        if (typeData && typeData.damageTaken[sourceType] === 3)
            return false;
        return true;
    };
    ModdedDex.prototype.getEffectiveness = function (source, target) {
        var sourceType = typeof source !== 'string' ? source.type : source;
        // @ts-ignore
        var targetTyping = target.getTypes && target.getTypes() || target.types || target;
        var totalTypeMod = 0;
        if (Array.isArray(targetTyping)) {
            for (var _i = 0, targetTyping_2 = targetTyping; _i < targetTyping_2.length; _i++) {
                var type = targetTyping_2[_i];
                totalTypeMod += this.getEffectiveness(sourceType, type);
            }
            return totalTypeMod;
        }
        var typeData = this.data.TypeChart[targetTyping];
        if (!typeData)
            return 0;
        switch (typeData.damageTaken[sourceType]) {
            case 1: return 1; // super-effective
            case 2: return -1; // resist
            // in case of weird situations like Gravity, immunity is handled elsewhere
            default: return 0;
        }
    };
    /**
     * Convert a pokemon name, ID, or template into its species name, preserving
     * form name (which is the main way Dex.getSpecies(id) differs from
     * Dex.getTemplate(id).species).
     */
    ModdedDex.prototype.getSpecies = function (species) {
        var id = toID(species || '');
        var template = this.getTemplate(id);
        if (template.otherForms && template.otherForms.indexOf(id) >= 0) {
            var form = id.slice(template.species.length);
            if (form)
                return template.species + '-' + form[0].toUpperCase() + form.slice(1);
        }
        return template.species;
    };
    ModdedDex.prototype.getTemplate = function (name) {
        if (name && typeof name !== 'string')
            return name;
        name = (name || '').trim();
        var id = toID(name);
        if (id === 'nidoran' && name.slice(-1) === '♀') {
            id = 'nidoranf';
        }
        else if (id === 'nidoran' && name.slice(-1) === '♂') {
            id = 'nidoranm';
        }
        var template = this.templateCache.get(id);
        if (template)
            return template;
        if (this.data.Aliases.hasOwnProperty(id)) {
            if (this.data.FormatsData.hasOwnProperty(id)) {
                // special event ID, like Rockruff-Dusk
                var baseId = toID(this.data.Aliases[id]);
                template = new Data.Template({ name: name }, this.data.Pokedex[baseId], this.data.FormatsData[id], this.data.Learnsets[id]);
                template.name = id;
                template.species = id;
                template.speciesid = id;
                template.abilities = { 0: template.abilities['S'] };
            }
            else {
                template = this.getTemplate(this.data.Aliases[id]);
            }
            if (template) {
                this.templateCache.set(id, template);
            }
            return template;
        }
        if (!this.data.Pokedex.hasOwnProperty(id)) {
            var aliasTo = '';
            if (id.startsWith('mega') && this.data.Pokedex[id.slice(4) + 'mega']) {
                aliasTo = id.slice(4) + 'mega';
            }
            else if (id.startsWith('m') && this.data.Pokedex[id.slice(1) + 'mega']) {
                aliasTo = id.slice(1) + 'mega';
            }
            else if (id.startsWith('primal') && this.data.Pokedex[id.slice(6) + 'primal']) {
                aliasTo = id.slice(6) + 'primal';
            }
            else if (id.startsWith('p') && this.data.Pokedex[id.slice(1) + 'primal']) {
                aliasTo = id.slice(1) + 'primal';
            }
            if (aliasTo) {
                template = this.getTemplate(aliasTo);
                if (template.exists) {
                    this.templateCache.set(id, template);
                    return template;
                }
            }
        }
        if (id && this.data.Pokedex.hasOwnProperty(id)) {
            template = new Data.Template({ name: name }, this.data.Pokedex[id], this.data.FormatsData[id], this.data.Learnsets[id]);
            // Inherit any statuses from the base species (Arceus, Silvally).
            var baseSpeciesStatuses = this.data.Statuses[toID(template.baseSpecies)];
            if (baseSpeciesStatuses !== undefined) {
                var key = void 0;
                for (key in baseSpeciesStatuses) {
                    if (!(key in template))
                        template[key] = baseSpeciesStatuses[key];
                }
            }
            if (!template.tier && !template.doublesTier && template.baseSpecies !== template.species) {
                if (template.baseSpecies === 'Mimikyu') {
                    template.tier = this.data.FormatsData[toID(template.baseSpecies)].tier || 'Illegal';
                    template.doublesTier = this.data.FormatsData[toID(template.baseSpecies)].doublesTier || 'Illegal';
                }
                else if (template.speciesid.endsWith('totem')) {
                    template.tier = this.data.FormatsData[template.speciesid.slice(0, -5)].tier || 'Illegal';
                    template.doublesTier = this.data.FormatsData[template.speciesid.slice(0, -5)].doublesTier || 'Illegal';
                }
                else {
                    template.tier = this.data.FormatsData[toID(template.baseSpecies)].tier || 'Illegal';
                    template.doublesTier = this.data.FormatsData[toID(template.baseSpecies)].doublesTier || 'Illegal';
                }
            }
            if (!template.tier)
                template.tier = 'Illegal';
            if (!template.doublesTier)
                template.doublesTier = template.tier;
            if (template.gen > this.gen) {
                template.tier = 'Illegal';
                template.doublesTier = 'Illegal';
                template.isNonstandard = 'Future';
            }
            if (this.currentMod === 'letsgo' && !template.isNonstandard) {
                var isLetsGo = ((template.num <= 151 || ['Meltan', 'Melmetal'].includes(template.name)) &&
                    (!template.forme || ['Alola', 'Mega', 'Mega-X', 'Mega-Y', 'Starter'].includes(template.forme)));
                if (!isLetsGo)
                    template.isNonstandard = 'Past';
            }
        }
        else {
            template = new Data.Template({
                id: id, name: name, exists: false, tier: 'Illegal', doublesTier: 'Illegal', isNonstandard: 'Custom'
            });
        }
        if (template.exists)
            this.templateCache.set(id, template);
        return template;
    };
    ModdedDex.prototype.getLearnset = function (template) {
        var id = toID(template);
        if (!this.data.Learnsets[id])
            return null;
        return this.data.Learnsets[id].learnset;
    };
    ModdedDex.prototype.getMove = function (name) {
        if (name && typeof name !== 'string')
            return name;
        name = (name || '').trim();
        var id = toID(name);
        var move = this.moveCache.get(id);
        if (move)
            return move;
        if (this.data.Aliases.hasOwnProperty(id)) {
            move = this.getMove(this.data.Aliases[id]);
            if (move.exists) {
                this.moveCache.set(id, move);
            }
            return move;
        }
        if (id.substr(0, 11) === 'hiddenpower') {
            id = /([a-z]*)([0-9]*)/.exec(id)[1];
        }
        if (id && this.data.Movedex.hasOwnProperty(id)) {
            move = new Data.Move({ name: name }, this.data.Movedex[id]);
            if (move.gen > this.gen) {
                move.isNonstandard = 'Future';
            }
        }
        else {
            move = new Data.Move({ id: id, name: name, exists: false });
        }
        if (move.exists)
            this.moveCache.set(id, move);
        return move;
    };
    /**
     * Ensure we're working on a copy of a move (and make a copy if we aren't)
     *
     * Remember: "ensure" - by default, it won't make a copy of a copy:
     *     moveCopy === Dex.getActiveMove(moveCopy)
     *
     * If you really want to, use:
     *     moveCopyCopy = Dex.getActiveMove(moveCopy.id)
     */
    ModdedDex.prototype.getActiveMove = function (move) {
        if (move && typeof move.hit === 'number')
            return move;
        move = this.getMove(move);
        var moveCopy = this.deepClone(move);
        moveCopy.hit = 0;
        return moveCopy;
    };
    /**
     * While this function can technically return any kind of effect at
     * all, that's not a feature TypeScript needs to know about.
     */
    ModdedDex.prototype.getEffect = function (name) {
        if (!name)
            return nullEffect;
        if (typeof name !== 'string')
            return name;
        var id = toID(name);
        var effect = this.effectCache.get(id);
        if (effect)
            return effect;
        if (name.startsWith('move:')) {
            effect = this.getMove(name.slice(5));
        }
        else if (name.startsWith('item:')) {
            effect = this.getItem(name.slice(5));
        }
        else if (name.startsWith('ability:')) {
            effect = this.getAbility(name.slice(8));
        }
        if (effect) {
            this.effectCache.set(id, effect);
            // @ts-ignore
            return effect;
        }
        return this.getEffectByID(id, effect);
    };
    ModdedDex.prototype.getEffectByID = function (id, effect) {
        if (!id)
            return nullEffect;
        if (!effect)
            effect = this.effectCache.get(id);
        if (effect)
            return effect;
        var found;
        if (this.data.Formats.hasOwnProperty(id)) {
            effect = new Data.Format({ name: id }, this.data.Formats[id]);
        }
        else if (this.data.Statuses.hasOwnProperty(id)) {
            effect = new Data.PureEffect({ name: id }, this.data.Statuses[id]);
        }
        else if ((this.data.Movedex.hasOwnProperty(id) && (found = this.data.Movedex[id]).effect) ||
            (this.data.Abilities.hasOwnProperty(id) && (found = this.data.Abilities[id]).effect) ||
            (this.data.Items.hasOwnProperty(id) && (found = this.data.Items[id]).effect)) {
            effect = new Data.PureEffect({ name: found.name || id }, found.effect);
        }
        else if (id === 'recoil') {
            effect = new Data.PureEffect({ id: id, name: 'Recoil', effectType: 'Recoil' });
        }
        else if (id === 'drain') {
            effect = new Data.PureEffect({ id: id, name: 'Drain', effectType: 'Drain' });
        }
        else {
            effect = new Data.PureEffect({ id: id, name: id, exists: false });
        }
        this.effectCache.set(id, effect);
        return effect;
    };
    /**
     * Returns a sanitized format ID if valid, or throws if invalid.
     */
    ModdedDex.prototype.validateFormat = function (name) {
        var _this = this;
        var _a = name.split('@@@', 2), formatName = _a[0], customRulesString = _a[1];
        var format = this.getFormat(formatName);
        if (!format.exists)
            throw new Error("Unrecognized format \"" + formatName + "\"");
        if (!customRulesString)
            return format.id;
        var ruleTable = this.getRuleTable(format);
        var customRules = customRulesString.split(',').map(function (rule) {
            var ruleSpec = _this.validateRule(rule);
            if (typeof ruleSpec === 'string' && ruleTable.has(ruleSpec))
                return null;
            return rule.replace(/[\r\n|]*/g, '').trim();
        }).filter(function (rule) { return rule; });
        if (!customRules.length)
            throw new Error("The format already has your custom rules");
        var validatedFormatid = format.id + '@@@' + customRules.join(',');
        var moddedFormat = this.getFormat(validatedFormatid, true);
        this.getRuleTable(moddedFormat);
        return validatedFormatid;
    };
    ModdedDex.prototype.getFormat = function (name, isTrusted) {
        if (isTrusted === void 0) { isTrusted = false; }
        if (name && typeof name !== 'string')
            return name;
        name = (name || '').trim();
        var id = toID(name);
        if (this.data.Aliases.hasOwnProperty(id)) {
            name = this.data.Aliases[id];
            id = toID(name);
        }
        if (this.data.Formats.hasOwnProperty('gen7' + id)) {
            id = ('gen7' + id);
        }
        var supplementaryAttributes = null;
        if (name.includes('@@@')) {
            if (!isTrusted) {
                try {
                    name = this.validateFormat(name);
                    isTrusted = true;
                }
                catch (e) { }
            }
            var _a = name.split('@@@', 2), newName = _a[0], customRulesString = _a[1];
            name = newName;
            id = toID(name);
            if (isTrusted && customRulesString) {
                supplementaryAttributes = {
                    customRules: customRulesString.split(','),
                    searchShow: false
                };
            }
        }
        var effect;
        if (this.data.Formats.hasOwnProperty(id)) {
            effect = new Data.Format({ name: name }, this.data.Formats[id], supplementaryAttributes);
        }
        else {
            effect = new Data.Format({ id: id, name: name, exists: false });
        }
        return effect;
    };
    ModdedDex.prototype.getItem = function (name) {
        if (name && typeof name !== 'string')
            return name;
        name = (name || '').trim();
        var id = toID(name);
        var item = this.itemCache.get(id);
        if (item)
            return item;
        if (this.data.Aliases.hasOwnProperty(id)) {
            item = this.getItem(this.data.Aliases[id]);
            if (item.exists) {
                this.itemCache.set(id, item);
            }
            return item;
        }
        if (id && !this.data.Items[id] && this.data.Items[id + 'berry']) {
            item = this.getItem(id + 'berry');
            this.itemCache.set(id, item);
            return item;
        }
        if (id && this.data.Items.hasOwnProperty(id)) {
            item = new Data.Item({ name: name }, this.data.Items[id]);
            if (item.gen > this.gen) {
                item.isNonstandard = 'Future';
            }
            // hack for allowing mega evolution in LGPE
            if (this.currentMod === 'letsgo' && !item.isNonstandard && !item.megaStone) {
                item.isNonstandard = 'Past';
            }
        }
        else {
            item = new Data.Item({ id: id, name: name, exists: false });
        }
        if (item.exists)
            this.itemCache.set(id, item);
        return item;
    };
    ModdedDex.prototype.getAbility = function (name) {
        if (name === void 0) { name = ''; }
        if (name && typeof name !== 'string')
            return name;
        var id = toID(name);
        var ability = this.abilityCache.get(id);
        if (ability)
            return ability;
        if (this.data.Aliases.hasOwnProperty(id)) {
            ability = this.getAbility(this.data.Aliases[id]);
            if (ability.exists) {
                this.abilityCache.set(id, ability);
            }
            return ability;
        }
        if (id && this.data.Abilities.hasOwnProperty(id)) {
            ability = new Data.Ability({ name: name }, this.data.Abilities[id]);
            if (ability.gen > this.gen) {
                ability.isNonstandard = 'Future';
            }
            if (this.currentMod === 'letsgo' && ability.id !== 'noability') {
                ability.isNonstandard = 'Past';
            }
            if ((this.currentMod === 'letsgo' || this.gen <= 2) && ability.id === 'noability') {
                ability.isNonstandard = null;
            }
        }
        else {
            ability = new Data.Ability({ id: id, name: name, exists: false });
        }
        if (ability.exists)
            this.abilityCache.set(id, ability);
        return ability;
    };
    ModdedDex.prototype.getType = function (name) {
        if (name && typeof name !== 'string')
            return name;
        var id = toID(name);
        var typeName = id.charAt(0).toUpperCase() + id.substr(1);
        var type = this.typeCache.get(typeName);
        if (type)
            return type;
        if (typeName && this.data.TypeChart.hasOwnProperty(typeName)) {
            type = new Data.TypeInfo({ id: id, name: typeName }, this.data.TypeChart[typeName]);
        }
        else {
            type = new Data.TypeInfo({ id: id, name: name, exists: false, effectType: 'EffectType' });
        }
        if (type.exists)
            this.typeCache.set(id, type);
        return type;
    };
    ModdedDex.prototype.getNature = function (name) {
        if (name && typeof name !== 'string')
            return name;
        name = (name || '').trim();
        var id = toID(name);
        // tslint:disable-next-line:no-object-literal-type-assertion
        var nature = {};
        if (id && id !== 'constructor' && this.data.Natures[id]) {
            nature = this.data.Natures[id];
            if (nature.cached)
                return nature;
            nature.cached = true;
            nature.exists = true;
        }
        if (!nature.id)
            nature.id = id;
        if (!nature.name)
            nature.name = name;
        nature.toString = this.effectToString;
        if (!nature.effectType)
            nature.effectType = 'Nature';
        if (!nature.gen)
            nature.gen = 3;
        return nature;
    };
    ModdedDex.prototype.getAwakeningValues = function (set, statName) {
        if (typeof statName === 'string')
            statName = toID(statName);
        var avs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        var ev;
        for (ev in set.evs) {
            avs[ev] = set.evs[ev];
        }
        if (typeof statName === 'string' && statName in avs)
            return avs[statName];
        return avs;
    };
    /** Given a table of base stats and a pokemon set, return the actual stats. */
    ModdedDex.prototype.spreadModify = function (baseStats, set) {
        var modStats = { atk: 10, def: 10, spa: 10, spd: 10, spe: 10 };
        var tr = this.trunc;
        var statName;
        for (statName in modStats) {
            var stat = baseStats[statName];
            modStats[statName] = tr(tr(2 * stat + set.ivs[statName] + tr(set.evs[statName] / 4)) * set.level / 100 + 5);
        }
        if ('hp' in baseStats) {
            var stat = baseStats['hp'];
            modStats['hp'] = tr(tr(2 * stat + set.ivs['hp'] + tr(set.evs['hp'] / 4) + 100) * set.level / 100 + 10);
        }
        return this.natureModify(modStats, set);
    };
    ModdedDex.prototype.natureModify = function (stats, set) {
        var nature = this.getNature(set.nature);
        var stat;
        if (nature.plus) {
            stat = nature.plus;
            stats[stat] = Math.floor(stats[stat] * 1.1);
        }
        if (nature.minus) {
            stat = nature.minus;
            stats[stat] = Math.floor(stats[stat] * 0.9);
        }
        return stats;
    };
    ModdedDex.prototype.getHiddenPower = function (ivs) {
        var hpTypes = [
            'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel',
            'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark',
        ];
        var tr = this.trunc;
        var stats = { hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31 };
        if (this.gen <= 2) {
            // Gen 2 specific Hidden Power check. IVs are still treated 0-31 so we get them 0-15
            var atkDV = tr(ivs.atk / 2);
            var defDV = tr(ivs.def / 2);
            var speDV = tr(ivs.spe / 2);
            var spcDV = tr(ivs.spa / 2);
            return {
                type: hpTypes[4 * (atkDV % 4) + (defDV % 4)],
                power: tr((5 * ((spcDV >> 3) + (2 * (speDV >> 3)) + (4 * (defDV >> 3)) + (8 * (atkDV >> 3))) + (spcDV % 4)) / 2 + 31)
            };
        }
        else {
            // Hidden Power check for Gen 3 onwards
            var hpTypeX = 0;
            var hpPowerX = 0;
            var i = 1;
            for (var s in stats) {
                hpTypeX += i * (ivs[s] % 2);
                hpPowerX += i * (tr(ivs[s] / 2) % 2);
                i *= 2;
            }
            return {
                type: hpTypes[tr(hpTypeX * 15 / 63)],
                // After Gen 6, Hidden Power is always 60 base power
                power: (this.gen && this.gen < 6) ? tr(hpPowerX * 40 / 63) + 30 : 60
            };
        }
    };
    ModdedDex.prototype.getRuleTable = function (format, depth) {
        if (depth === void 0) { depth = 0; }
        if (format.ruleTable)
            return format.ruleTable;
        var ruleTable = new Data.RuleTable();
        var ruleset = format.ruleset.slice();
        for (var _i = 0, _a = format.banlist; _i < _a.length; _i++) {
            var ban = _a[_i];
            ruleset.push('-' + ban);
        }
        for (var _b = 0, _c = format.unbanlist; _b < _c.length; _b++) {
            var ban = _c[_b];
            ruleset.push('+' + ban);
        }
        if (format.customRules) {
            ruleset.push.apply(ruleset, format.customRules);
        }
        if (format.checkLearnset) {
            ruleTable.checkLearnset = [format.checkLearnset, format.name];
        }
        if (format.timer) {
            ruleTable.timer = [format.timer, format.name];
        }
        // apply rule repeals before other rules
        for (var _d = 0, ruleset_1 = ruleset; _d < ruleset_1.length; _d++) {
            var rule = ruleset_1[_d];
            if (rule.startsWith('!')) {
                var ruleSpec = this.validateRule(rule, format);
                ruleTable.set(ruleSpec, '');
            }
        }
        for (var _e = 0, ruleset_2 = ruleset; _e < ruleset_2.length; _e++) {
            var rule = ruleset_2[_e];
            if (rule.startsWith('!'))
                continue;
            var ruleSpec = this.validateRule(rule, format);
            if (typeof ruleSpec !== 'string') {
                if (ruleSpec[0] === 'complexTeamBan') {
                    var complexTeamBan = ruleSpec.slice(1);
                    ruleTable.addComplexTeamBan(complexTeamBan[0], complexTeamBan[1], complexTeamBan[2], complexTeamBan[3]);
                }
                else if (ruleSpec[0] === 'complexBan') {
                    var complexBan = ruleSpec.slice(1);
                    ruleTable.addComplexBan(complexBan[0], complexBan[1], complexBan[2], complexBan[3]);
                }
                else {
                    throw new Error("Unrecognized rule spec " + ruleSpec);
                }
                continue;
            }
            if ("!+-".includes(ruleSpec.charAt(0))) {
                if (ruleSpec.startsWith('+'))
                    ruleTable["delete"]('-' + ruleSpec.slice(1));
                if (ruleSpec.startsWith('-'))
                    ruleTable["delete"]('+' + ruleSpec.slice(1));
                ruleTable.set(ruleSpec, '');
                continue;
            }
            var subformat = this.getFormat(ruleSpec);
            if (ruleTable.has('!' + subformat.id))
                continue;
            ruleTable.set(subformat.id, '');
            if (!subformat.exists)
                continue;
            if (depth > 16) {
                throw new Error("Excessive ruleTable recursion in " + format.name + ": " + ruleSpec + " of " + format.ruleset);
            }
            var subRuleTable = this.getRuleTable(subformat, depth + 1);
            for (var _f = 0, subRuleTable_1 = subRuleTable; _f < subRuleTable_1.length; _f++) {
                var _g = subRuleTable_1[_f], k = _g[0], v = _g[1];
                if (!ruleTable.has('!' + k))
                    ruleTable.set(k, v || subformat.name);
            }
            // tslint:disable-next-line:no-shadowed-variable
            for (var _h = 0, _j = subRuleTable.complexBans; _h < _j.length; _h++) {
                var _k = _j[_h], rule_1 = _k[0], source = _k[1], limit = _k[2], bans = _k[3];
                ruleTable.addComplexBan(rule_1, source || subformat.name, limit, bans);
            }
            // tslint:disable-next-line:no-shadowed-variable
            for (var _l = 0, _m = subRuleTable.complexTeamBans; _l < _m.length; _l++) {
                var _o = _m[_l], rule_2 = _o[0], source = _o[1], limit = _o[2], bans = _o[3];
                ruleTable.addComplexTeamBan(rule_2, source || subformat.name, limit, bans);
            }
            if (subRuleTable.checkLearnset) {
                if (ruleTable.checkLearnset) {
                    throw new Error("\"" + format.name + "\" has conflicting move validation rules from " +
                        ("\"" + ruleTable.checkLearnset[1] + "\" and \"" + subRuleTable.checkLearnset[1] + "\""));
                }
                ruleTable.checkLearnset = subRuleTable.checkLearnset;
            }
            if (subRuleTable.timer) {
                if (ruleTable.timer) {
                    throw new Error("\"" + format.name + "\" has conflicting timer validation rules from " +
                        ("\"" + ruleTable.timer[1] + "\" and \"" + subRuleTable.timer[1] + "\""));
                }
                ruleTable.timer = subRuleTable.timer;
            }
        }
        format.ruleTable = ruleTable;
        return ruleTable;
    };
    ModdedDex.prototype.validateRule = function (rule, format) {
        var _this = this;
        if (format === void 0) { format = null; }
        switch (rule.charAt(0)) {
            case '-':
            case '+':
                if (format && format.team)
                    throw new Error("We don't currently support bans in generated teams");
                if (rule.slice(1).includes('>') || rule.slice(1).includes('+')) {
                    var buf = rule.slice(1);
                    var gtIndex = buf.lastIndexOf('>');
                    var limit = rule.charAt(0) === '+' ? Infinity : 0;
                    if (gtIndex >= 0 && /^[0-9]+$/.test(buf.slice(gtIndex + 1).trim())) {
                        if (limit === 0)
                            limit = parseInt(buf.slice(gtIndex + 1), 10);
                        buf = buf.slice(0, gtIndex);
                    }
                    var checkTeam = buf.includes('++');
                    var banNames = buf.split(checkTeam ? '++' : '+').map(function (v) { return v.trim(); });
                    if (banNames.length === 1 && limit > 0)
                        checkTeam = true;
                    var innerRule = banNames.join(checkTeam ? ' ++ ' : ' + ');
                    var bans = banNames.map(function (v) { return _this.validateBanRule(v); });
                    if (checkTeam) {
                        return ['complexTeamBan', innerRule, '', limit, bans];
                    }
                    if (bans.length > 1 || limit > 0) {
                        return ['complexBan', innerRule, '', limit, bans];
                    }
                    throw new Error("Confusing rule " + rule);
                }
                return rule.charAt(0) + this.validateBanRule(rule.slice(1));
            default:
                var id = toID(rule);
                if (!this.data.Formats.hasOwnProperty(id)) {
                    throw new Error("Unrecognized rule \"" + rule + "\"");
                }
                if (rule.charAt(0) === '!')
                    return "!" + id;
                return id;
        }
    };
    ModdedDex.prototype.validateBanRule = function (rule) {
        var id = toID(rule);
        if (id === 'unreleased')
            return 'unreleased';
        if (id === 'nonexistent')
            return 'nonexistent';
        var matches = [];
        var matchTypes = ['pokemon', 'move', 'ability', 'item', 'pokemontag'];
        for (var _i = 0, matchTypes_1 = matchTypes; _i < matchTypes_1.length; _i++) {
            var matchType = matchTypes_1[_i];
            if (rule.slice(0, 1 + matchType.length) === matchType + ':') {
                matchTypes = [matchType];
                id = id.slice(matchType.length);
                break;
            }
        }
        var ruleid = id;
        if (this.data.Aliases.hasOwnProperty(id))
            id = toID(this.data.Aliases[id]);
        for (var _a = 0, matchTypes_2 = matchTypes; _a < matchTypes_2.length; _a++) {
            var matchType = matchTypes_2[_a];
            var table = void 0;
            switch (matchType) {
                case 'pokemon':
                    table = this.data.Pokedex;
                    break;
                case 'move':
                    table = this.data.Movedex;
                    break;
                case 'item':
                    table = this.data.Items;
                    break;
                case 'ability':
                    table = this.data.Abilities;
                    break;
                case 'pokemontag':
                    // valid pokemontags
                    var validTags = [
                        // singles tiers
                        'uber', 'ou', 'uubl', 'uu', 'rubl', 'ru', 'nubl', 'nu', 'publ', 'pu', 'zu', 'nfe', 'lcuber', 'lc', 'cap', 'caplc', 'capnfe', 'ag',
                        // doubles tiers
                        'duber', 'dou', 'dbl', 'duu', 'dnu',
                        // custom tags
                        'mega',
                        // illegal/nonstandard reasons
                        'glitch', 'past', 'future', 'lgpe', 'pokestar', 'custom',
                    ];
                    if (validTags.includes(ruleid))
                        matches.push('pokemontag:' + ruleid);
                    continue;
                default:
                    throw new Error("Unrecognized match type.");
            }
            if (table.hasOwnProperty(id)) {
                if (matchType === 'pokemon') {
                    var template = table[id];
                    if (template.otherFormes) {
                        matches.push('basepokemon:' + id);
                        continue;
                    }
                }
                matches.push(matchType + ':' + id);
            }
            else if (matchType === 'pokemon' && id.slice(-4) === 'base') {
                id = id.slice(0, -4);
                if (table.hasOwnProperty(id)) {
                    matches.push('pokemon:' + id);
                }
            }
        }
        if (matches.length > 1) {
            throw new Error("More than one thing matches \"" + rule + "\"; please use something like \"-item:metronome\" to disambiguate");
        }
        if (matches.length < 1) {
            throw new Error("Nothing matches \"" + rule + "\"");
        }
        return matches[0];
    };
    ModdedDex.prototype.shuffle = function (arr) {
        var _a;
        // In-place shuffle by Fisher-Yates algorithm
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            _a = [arr[j], arr[i]], arr[i] = _a[0], arr[j] = _a[1];
        }
        return arr;
    };
    ModdedDex.prototype.levenshtein = function (s, t, l) {
        // Original levenshtein distance function by James Westgate, turned out to be the fastest
        var d = [];
        // Step 1
        var n = s.length;
        var m = t.length;
        if (n === 0)
            return m;
        if (m === 0)
            return n;
        if (l && Math.abs(m - n) > l)
            return Math.abs(m - n);
        // Create an array of arrays in javascript (a descending loop is quicker)
        for (var i = n; i >= 0; i--)
            d[i] = [];
        // Step 2
        for (var i = n; i >= 0; i--)
            d[i][0] = i;
        for (var j = m; j >= 0; j--)
            d[0][j] = j;
        // Step 3
        for (var i = 1; i <= n; i++) {
            var si = s.charAt(i - 1);
            // Step 4
            for (var j = 1; j <= m; j++) {
                // Check the jagged ld total so far
                if (i === j && d[i][j] > 4)
                    return n;
                var tj = t.charAt(j - 1);
                var cost = (si === tj) ? 0 : 1; // Step 5
                // Calculate the minimum
                var mi = d[i - 1][j] + 1;
                var b = d[i][j - 1] + 1;
                var c = d[i - 1][j - 1] + cost;
                if (b < mi)
                    mi = b;
                if (c < mi)
                    mi = c;
                d[i][j] = mi; // Step 6
            }
        }
        // Step 7
        return d[n][m];
    };
    /** Forces num to be an integer (between min and max). */
    ModdedDex.prototype.clampIntRange = function (num, min, max) {
        if (typeof num !== 'number')
            num = 0;
        num = Math.floor(num);
        if (min !== undefined && num < min)
            num = min;
        if (max !== undefined && num > max)
            num = max;
        return num;
    };
    /**
     * Truncate a number into an unsigned 32-bit integer, for
     * compatibility with the cartridge games' math systems.
     */
    ModdedDex.prototype.trunc = function (num, bits) {
        if (bits === void 0) { bits = 0; }
        if (bits)
            return (num >>> 0) % (Math.pow(2, bits));
        return num >>> 0;
    };
    ModdedDex.prototype.getTeamGenerator = function (format, seed) {
        if (seed === void 0) { seed = null; }
        var TeamGenerator = require(dexes['base'].forFormat(format).dataDir + '/random-teams');
        return new TeamGenerator(format, seed);
    };
    ModdedDex.prototype.generateTeam = function (format, options) {
        if (options === void 0) { options = null; }
        return this.getTeamGenerator(format, options && options.seed).getTeam(options);
    };
    ModdedDex.prototype.dataSearch = function (target, searchIn, isInexact) {
        if (!target)
            return false;
        searchIn = searchIn || ['Pokedex', 'Movedex', 'Abilities', 'Items', 'Natures'];
        var searchFunctions = {
            Pokedex: 'getTemplate', Movedex: 'getMove', Abilities: 'getAbility', Items: 'getItem', Natures: 'getNature'
        };
        var searchTypes = {
            Pokedex: 'pokemon', Movedex: 'move', Abilities: 'ability', Items: 'item', Natures: 'nature'
        };
        var searchResults = [];
        for (var _i = 0, searchIn_1 = searchIn; _i < searchIn_1.length; _i++) {
            var table = searchIn_1[_i];
            // @ts-ignore
            var res = this[searchFunctions[table]](target);
            if (res.exists && res.gen <= this.gen) {
                searchResults.push({
                    isInexact: isInexact,
                    searchType: searchTypes[table],
                    name: res.species ? res.species : res.name
                });
            }
        }
        if (searchResults.length)
            return searchResults;
        if (isInexact)
            return false; // prevent infinite loop
        var cmpTarget = toID(target);
        var maxLd = 3;
        if (cmpTarget.length <= 1) {
            return false;
        }
        else if (cmpTarget.length <= 4) {
            maxLd = 1;
        }
        else if (cmpTarget.length <= 6) {
            maxLd = 2;
        }
        searchResults = false;
        for (var _a = 0, _b = __spreadArrays(searchIn, ['Aliases']); _a < _b.length; _a++) {
            var table = _b[_a];
            var searchObj = this.data[table];
            if (!searchObj)
                continue;
            for (var j in searchObj) {
                var ld = this.levenshtein(cmpTarget, j, maxLd);
                if (ld <= maxLd) {
                    var word = searchObj[j].name || searchObj[j].species || j;
                    var results = this.dataSearch(word, searchIn, word);
                    if (results) {
                        searchResults = results;
                        maxLd = ld;
                    }
                }
            }
        }
        return searchResults;
    };
    ModdedDex.prototype.packTeam = function (team) {
        if (!team)
            return '';
        var buf = '';
        for (var _i = 0, team_1 = team; _i < team_1.length; _i++) {
            var set = team_1[_i];
            if (buf)
                buf += ']';
            // name
            buf += (set.name || set.species);
            // species
            var id = toID(set.species || set.name);
            buf += '|' + (toID(set.name || set.species) === id ? '' : id);
            // item
            buf += '|' + toID(set.item);
            // ability
            buf += '|' + toID(set.ability);
            // moves
            buf += '|' + set.moves.map(toID).join(',');
            // nature
            buf += '|' + (set.nature || '');
            // evs
            var evs = '|';
            if (set.evs) {
                evs = '|' + (set.evs['hp'] || '') + ',' + (set.evs['atk'] || '') + ',' + (set.evs['def'] || '') + ',' + (set.evs['spa'] || '') + ',' + (set.evs['spd'] || '') + ',' + (set.evs['spe'] || '');
            }
            if (evs === '|,,,,,') {
                buf += '|';
            }
            else {
                buf += evs;
            }
            // gender
            if (set.gender) {
                buf += '|' + set.gender;
            }
            else {
                buf += '|';
            }
            // ivs
            var getIv = function (ivs, s) {
                return ivs[s] === 31 || ivs[s] === undefined ? '' : ivs[s].toString();
            };
            var ivs = '|';
            if (set.ivs) {
                ivs = '|' + getIv(set.ivs, 'hp') + ',' + getIv(set.ivs, 'atk') + ',' + getIv(set.ivs, 'def') +
                    ',' + getIv(set.ivs, 'spa') + ',' + getIv(set.ivs, 'spd') + ',' + getIv(set.ivs, 'spe');
            }
            if (ivs === '|,,,,,') {
                buf += '|';
            }
            else {
                buf += ivs;
            }
            // shiny
            if (set.shiny) {
                buf += '|S';
            }
            else {
                buf += '|';
            }
            // level
            if (set.level && set.level !== 100) {
                buf += '|' + set.level;
            }
            else {
                buf += '|';
            }
            // happiness
            if (set.happiness !== undefined && set.happiness !== 255) {
                buf += '|' + set.happiness;
            }
            else {
                buf += '|';
            }
            if (set.pokeball || set.hpType) {
                buf += ',' + set.hpType;
                buf += ',' + toID(set.pokeball);
            }
        }
        return buf;
    };
    ModdedDex.prototype.fastUnpackTeam = function (buf) {
        if (!buf)
            return null;
        if (typeof buf !== 'string')
            return buf;
        if (buf.charAt(0) === '[' && buf.charAt(buf.length - 1) === ']') {
            buf = this.packTeam(JSON.parse(buf));
        }
        var team = [];
        var i = 0;
        var j = 0;
        // limit to 24
        for (var count = 0; count < 24; count++) {
            // tslint:disable-next-line:no-object-literal-type-assertion
            var set = {};
            team.push(set);
            // name
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            set.name = buf.substring(i, j);
            i = j + 1;
            // species
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            set.species = buf.substring(i, j) || set.name;
            i = j + 1;
            // item
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            set.item = buf.substring(i, j);
            i = j + 1;
            // ability
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            var ability = buf.substring(i, j);
            var template = dexes['base'].getTemplate(set.species);
            set.ability = ['', '0', '1', 'H', 'S'].includes(ability) ?
                template.abilities[ability || '0'] || (ability === '' ? '' : '!!!ERROR!!!') :
                ability;
            i = j + 1;
            // moves
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            set.moves = buf.substring(i, j).split(',', 24).filter(function (x) { return x; });
            i = j + 1;
            // nature
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            set.nature = buf.substring(i, j);
            i = j + 1;
            // evs
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            if (j !== i) {
                var evs = buf.substring(i, j).split(',', 6);
                set.evs = {
                    hp: Number(evs[0]) || 0,
                    atk: Number(evs[1]) || 0,
                    def: Number(evs[2]) || 0,
                    spa: Number(evs[3]) || 0,
                    spd: Number(evs[4]) || 0,
                    spe: Number(evs[5]) || 0
                };
            }
            i = j + 1;
            // gender
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            if (i !== j)
                set.gender = buf.substring(i, j);
            i = j + 1;
            // ivs
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            if (j !== i) {
                var ivs = buf.substring(i, j).split(',', 6);
                set.ivs = {
                    hp: ivs[0] === '' ? 31 : Number(ivs[0]) || 0,
                    atk: ivs[1] === '' ? 31 : Number(ivs[1]) || 0,
                    def: ivs[2] === '' ? 31 : Number(ivs[2]) || 0,
                    spa: ivs[3] === '' ? 31 : Number(ivs[3]) || 0,
                    spd: ivs[4] === '' ? 31 : Number(ivs[4]) || 0,
                    spe: ivs[5] === '' ? 31 : Number(ivs[5]) || 0
                };
            }
            i = j + 1;
            // shiny
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            if (i !== j)
                set.shiny = true;
            i = j + 1;
            // level
            j = buf.indexOf('|', i);
            if (j < 0)
                return null;
            if (i !== j)
                set.level = parseInt(buf.substring(i, j), 10);
            i = j + 1;
            // happiness
            j = buf.indexOf(']', i);
            var misc = void 0;
            if (j < 0) {
                if (i < buf.length)
                    misc = buf.substring(i).split(',', 3);
            }
            else {
                if (i !== j)
                    misc = buf.substring(i, j).split(',', 3);
            }
            if (misc) {
                set.happiness = (misc[0] ? Number(misc[0]) : 255);
                set.hpType = misc[1];
                set.pokeball = misc[2];
            }
            if (j < 0)
                break;
            i = j + 1;
        }
        return team;
    };
    ModdedDex.prototype.deepClone = function (obj) {
        var _this = this;
        if (obj === null || typeof obj !== 'object')
            return obj;
        if (Array.isArray(obj))
            return obj.map(function (prop) { return _this.deepClone(prop); });
        var clone = Object.create(Object.getPrototypeOf(obj));
        for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
            var key = _a[_i];
            clone[key] = this.deepClone(obj[key]);
        }
        return clone;
    };
    ModdedDex.prototype.loadDataFile = function (basePath, dataType) {
        try {
            var filePath = basePath + DATA_FILES[dataType];
            var dataObject = require(filePath);
            var key = "Battle" + dataType;
            if (!dataObject || typeof dataObject !== 'object') {
                return new TypeError(filePath + ", if it exists, must export a non-null object");
            }
            if (!dataObject[key] || typeof dataObject[key] !== 'object') {
                return new TypeError(filePath + ", if it exists, must export an object whose '" + key + "' property is a non-null object");
            }
            return dataObject[key];
        }
        catch (e) {
            if (e.code !== 'MODULE_NOT_FOUND' && e.code !== 'ENOENT') {
                throw e;
            }
        }
        return {};
    };
    ModdedDex.prototype.includeMods = function () {
        if (!this.isBase)
            throw new Error("This must be called on the base Dex");
        if (this.modsLoaded)
            return this;
        for (var _i = 0, _a = fs.readdirSync(MODS_DIR); _i < _a.length; _i++) {
            var mod = _a[_i];
            dexes[mod] = new ModdedDex(mod, true);
        }
        this.modsLoaded = true;
        return this;
    };
    ModdedDex.prototype.includeModData = function () {
        for (var mod in this.dexes) {
            dexes[mod].includeData();
        }
        return this;
    };
    ModdedDex.prototype.includeData = function () {
        this.loadData();
        return this;
    };
    ModdedDex.prototype.loadData = function () {
        if (this.dataCache)
            return this.dataCache;
        dexes['base'].includeMods();
        var dataCache = {};
        var basePath = this.dataDir + '/';
        var BattleScripts = this.loadDataFile(basePath, 'Scripts');
        this.parentMod = this.isBase ? '' : (BattleScripts.inherit || 'base');
        var parentDex;
        if (this.parentMod) {
            parentDex = dexes[this.parentMod];
            if (!parentDex || parentDex === this) {
                throw new Error("Unable to load " + this.currentMod + ". `inherit` should specify a parent mod " +
                    "from which to inherit data, or must be not specified.");
            }
        }
        for (var _i = 0, _a = DATA_TYPES.concat('Aliases'); _i < _a.length; _i++) {
            var dataType = _a[_i];
            if (dataType === 'Natures' && this.isBase) {
                dataCache[dataType] = BattleNatures;
                continue;
            }
            var BattleData = this.loadDataFile(basePath, dataType);
            if (!BattleData || typeof BattleData !== 'object') {
                throw new TypeError("Exported property `Battle" + dataType + "`from `" + './data/' +
                    DATA_FILES[dataType] + "` must be an object except `null`.");
            }
            if (BattleData !== dataCache[dataType])
                dataCache[dataType] = Object.assign(BattleData, dataCache[dataType]);
            if (dataType === 'Formats' && !parentDex)
                Object.assign(BattleData, this.formats);
        }
        if (!parentDex) {
            // Formats are inherited by mods
            this.includeFormats();
        }
        else {
            for (var _b = 0, DATA_TYPES_1 = DATA_TYPES; _b < DATA_TYPES_1.length; _b++) {
                var dataType = DATA_TYPES_1[_b];
                var parentTypedData = parentDex.data[dataType];
                var childTypedData = dataCache[dataType] || (dataCache[dataType] = {});
                for (var entryId in parentTypedData) {
                    if (childTypedData[entryId] === null) {
                        // null means don't inherit
                        delete childTypedData[entryId];
                    }
                    else if (!(entryId in childTypedData)) {
                        // If it doesn't exist it's inherited from the parent data
                        if (dataType === 'Pokedex') {
                            // Pokedex entries can be modified too many different ways
                            // e.g. inheriting different formats-data/learnsets
                            childTypedData[entryId] = this.deepClone(parentTypedData[entryId]);
                        }
                        else {
                            childTypedData[entryId] = parentTypedData[entryId];
                        }
                    }
                    else if (childTypedData[entryId] && childTypedData[entryId].inherit) {
                        // {inherit: true} can be used to modify only parts of the parent data,
                        // instead of overwriting entirely
                        delete childTypedData[entryId].inherit;
                        // Merge parent into children entry, preserving existing childs' properties.
                        // @ts-ignore
                        for (var key in parentTypedData[entryId]) {
                            if (key in childTypedData[entryId])
                                continue;
                            // @ts-ignore
                            childTypedData[entryId][key] = parentTypedData[entryId][key];
                        }
                    }
                }
            }
            dataCache['Aliases'] = parentDex.data['Aliases'];
        }
        // Flag the generation. Required for team validator.
        this.gen = dataCache.Scripts.gen || 7;
        this.dataCache = dataCache;
        // Execute initialization script.
        if (BattleScripts.init)
            BattleScripts.init.call(this);
        return this.dataCache;
    };
    ModdedDex.prototype.includeFormats = function () {
        if (!this.isBase)
            throw new Error("This should only be run on the base mod");
        this.includeMods();
        if (this.formatsCache)
            return this;
        if (!this.formatsCache)
            this.formatsCache = {};
        // Load formats
        var Formats;
        try {
            Formats = require(FORMATS).Formats;
        }
        catch (e) {
            if (e.code !== 'MODULE_NOT_FOUND' && e.code !== 'ENOENT') {
                throw e;
            }
        }
        if (!Array.isArray(Formats)) {
            throw new TypeError("Exported property 'Formats' from \"./config/formats.js\" must be an array");
        }
        var section = '';
        var column = 1;
        for (var _i = 0, _a = Formats.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], format = _b[1];
            var id = toID(format.name);
            if (format.section)
                section = format.section;
            if (format.column)
                column = format.column;
            if (!format.name && format.section)
                continue;
            if (!id) {
                throw new RangeError("Format #" + (i + 1) + " must have a name with alphanumeric characters, not '" + format.name + "'");
            }
            if (!format.section)
                format.section = section;
            if (!format.column)
                format.column = column;
            if (this.formatsCache[id])
                throw new Error("Format #" + (i + 1) + " has a duplicate ID: '" + id + "'");
            format.effectType = 'Format';
            format.baseRuleset = format.ruleset ? format.ruleset.slice() : [];
            if (format.challengeShow === undefined)
                format.challengeShow = true;
            if (format.searchShow === undefined)
                format.searchShow = true;
            if (format.tournamentShow === undefined)
                format.tournamentShow = true;
            if (format.mod === undefined)
                format.mod = 'gen7';
            if (!dexes[format.mod])
                throw new Error("Format \"" + format.name + "\" requires nonexistent mod: '" + format.mod + "'");
            this.formatsCache[id] = format;
        }
        return this;
    };
    ModdedDex.prototype.installFormat = function (id, format) {
        dexes['base'].includeFormats();
        dexes['base'].formatsCache[id] = format;
        if (this.dataCache)
            this.dataCache.Formats[id] = format;
        if (!this.isBase) {
            if (dexes['base'].dataCache)
                dexes['base'].dataCache.Formats[id] = format;
        }
    };
    return ModdedDex;
}());
exports.ModdedDex = ModdedDex;
dexes['base'] = new ModdedDex(undefined, true);
// "gen7" is an alias for the current base data
dexes['gen7'] = dexes['base'];
exports.Dex = dexes['gen7'];
