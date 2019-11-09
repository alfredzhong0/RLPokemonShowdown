"use strict";
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
/**
 * Simulator Battle
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT
 */
var dex_1 = require("./dex");
global.toID = dex_1.Dex.getId;
var Data = require("./dex-data");
var field_1 = require("./field");
var pokemon_1 = require("./pokemon");
var prng_1 = require("./prng");
var side_1 = require("./side");
var state_1 = require("./state");
var Battle = /** @class */ (function () {
    function Battle(options) {
        var format = dex_1.Dex.getFormat(options.formatid, true);
        this.format = format;
        this.dex = dex_1.Dex.forFormat(format);
        this.gen = this.dex.gen;
        this.ruleTable = this.dex.getRuleTable(format);
        this.zMoveTable = {};
        Object.assign(this, this.dex.data.Scripts);
        if (format.battle)
            Object.assign(this, format.battle);
        this.id = '';
        this.debugMode = format.debug || !!options.debug;
        this.deserialized = !!options.deserialized;
        this.strictChoices = !!options.strictChoices;
        this.formatData = { id: format.id };
        this.gameType = (format.gameType || 'singles');
        this.field = new field_1.Field(this);
        var isFourPlayer = this.gameType === 'multi' || this.gameType === 'free-for-all';
        // @ts-ignore
        this.sides = Array(isFourPlayer ? 4 : 2).fill(null);
        this.prng = options.prng || new prng_1.PRNG(options.seed || undefined);
        this.prngSeed = this.prng.startingSeed.slice();
        this.rated = options.rated || !!options.rated;
        this.reportExactHP = !!format.debug;
        this.reportPercentages = false;
        this.supportCancel = false;
        this.queue = [];
        this.faintQueue = [];
        this.log = [];
        this.inputLog = [];
        this.messageLog = [];
        this.sentLogPos = 0;
        this.sentEnd = false;
        this.requestState = '';
        this.turn = 0;
        this.midTurn = false;
        this.started = false;
        this.ended = false;
        // tslint:disable-next-line:no-object-literal-type-assertion
        this.effect = { id: '' };
        this.effectData = { id: '' };
        this.event = { id: '' };
        this.events = null;
        this.eventDepth = 0;
        this.activeMove = null;
        this.activePokemon = null;
        this.activeTarget = null;
        this.lastMove = null;
        this.lastMoveLine = -1;
        this.lastMoveThisTurn = null;
        this.lastDamage = 0;
        this.abilityOrder = 0;
        this.teamGenerator = null;
        this.hints = new Set();
        this.NOT_FAIL = '';
        this.FAIL = false;
        this.SILENT_FAIL = null;
        this.send = options.send || (function () { });
        this.trunc = this.dex.trunc;
        // bound function for faster speedSort
        // (so speedSort doesn't need to bind before use)
        this.comparePriority = this.comparePriority.bind(this);
        var inputOptions = {
            formatid: options.formatid, seed: this.prng.seed
        };
        if (this.rated)
            inputOptions.rated = this.rated;
        if (global.__version) {
            if (global.__version.head) {
                this.inputLog.push(">version " + global.__version.head);
            }
            if (global.__version.origin) {
                this.inputLog.push(">version-origin " + global.__version.origin);
            }
        }
        this.inputLog.push(">start " + JSON.stringify(inputOptions));
        for (var _i = 0, _a = this.ruleTable.keys(); _i < _a.length; _i++) {
            var rule = _a[_i];
            if (rule.startsWith('+') || rule.startsWith('-') || rule.startsWith('!'))
                continue;
            var subFormat = this.dex.getFormat(rule);
            if (subFormat.exists) {
                var hasEventHandler = Object.keys(subFormat).some(function (val) {
                    return val.startsWith('on') && !['onBegin', 'onValidateTeam', 'onChangeSet', 'onValidateSet'].includes(val);
                });
                if (hasEventHandler)
                    this.field.addPseudoWeather(rule);
            }
        }
        var sides = ['p1', 'p2', 'p3', 'p4'];
        for (var _b = 0, sides_1 = sides; _b < sides_1.length; _b++) {
            var side = sides_1[_b];
            if (options[side]) {
                this.setPlayer(side, options[side]);
            }
        }
    }
    Battle.prototype.toJSON = function () {
        return state_1.State.serializeBattle(this);
    };
    Battle.fromJSON = function (serialized) {
        return state_1.State.deserializeBattle(serialized);
    };
    Object.defineProperty(Battle.prototype, "p1", {
        get: function () {
            return this.sides[0];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Battle.prototype, "p2", {
        get: function () {
            return this.sides[1];
        },
        enumerable: true,
        configurable: true
    });
    Battle.prototype.toString = function () {
        return "Battle: " + this.format;
    };
    Battle.prototype.random = function (m, n) {
        return this.prng.next(m, n);
    };
    Battle.prototype.randomChance = function (numerator, denominator) {
        return this.prng.randomChance(numerator, denominator);
    };
    Battle.prototype.sample = function (items) {
        return this.prng.sample(items);
    };
    Battle.prototype.resetRNG = function () {
        this.prng = new prng_1.PRNG(this.prng.startingSeed);
    };
    Battle.prototype.suppressingAttackEvents = function () {
        return this.activePokemon && this.activePokemon.isActive && this.activeMove && this.activeMove.ignoreAbility;
    };
    Battle.prototype.setActiveMove = function (move, pokemon, target) {
        this.activeMove = move || null;
        this.activePokemon = pokemon || null;
        this.activeTarget = target || pokemon || null;
    };
    Battle.prototype.clearActiveMove = function (failed) {
        if (this.activeMove) {
            this.lastMoveThisTurn = null;
            if (!failed) {
                this.lastMove = this.activeMove;
                this.lastMoveThisTurn = this.activeMove;
            }
            this.activeMove = null;
            this.activePokemon = null;
            this.activeTarget = null;
        }
    };
    Battle.prototype.updateSpeed = function () {
        for (var _i = 0, _a = this.getAllActive(); _i < _a.length; _i++) {
            var pokemon = _a[_i];
            pokemon.updateSpeed();
        }
    };
    Battle.prototype.comparePriority = function (a, b) {
        return -((b.order || 4294967296) - (a.order || 4294967296)) ||
            ((b.priority || 0) - (a.priority || 0)) ||
            ((b.speed || 0) - (a.speed || 0)) ||
            -((b.subOrder || 0) - (a.subOrder || 0)) ||
            ((a.thing && b.thing) ? -(b.thing.abilityOrder - a.thing.abilityOrder) : 0) ||
            0;
    };
    Battle.compareRedirectOrder = function (a, b) {
        return ((b.priority || 0) - (a.priority || 0)) ||
            ((b.speed || 0) - (a.speed || 0)) ||
            ((a.thing && b.thing) ? -(b.thing.abilityOrder - a.thing.abilityOrder) : 0) ||
            0;
    };
    Battle.compareLeftToRightOrder = function (a, b) {
        return -((b.order || 4294967296) - (a.order || 4294967296)) ||
            ((b.priority || 0) - (a.priority || 0)) ||
            -((b.index || 0) - (a.index || 0)) ||
            0;
    };
    /** Sort a list, resolving speed ties the way the games do. */
    Battle.prototype.speedSort = function (list, comparator) {
        var _a;
        if (comparator === void 0) { comparator = this.comparePriority; }
        if (list.length < 2)
            return;
        var sorted = 0;
        while (sorted + 1 < list.length) {
            var nextIndexes = [sorted];
            // grab list of next indexes
            for (var i = sorted + 1; i < list.length; i++) {
                var delta = comparator(list[nextIndexes[0]], list[i]);
                if (delta < 0)
                    continue;
                if (delta > 0)
                    nextIndexes = [i];
                if (delta === 0)
                    nextIndexes.push(i);
            }
            // put list of next indexes where they belong
            var nextCount = nextIndexes.length;
            for (var i = 0; i < nextCount; i++) {
                var index = nextIndexes[i];
                while (index > sorted + i) {
                    _a = [list[index - 1], list[index]], list[index] = _a[0], list[index - 1] = _a[1];
                    index--;
                }
            }
            if (nextCount > 1)
                this.prng.shuffle(list, sorted, sorted + nextCount);
            sorted += nextCount;
        }
    };
    Battle.prototype.eachEvent = function (eventid, effect, relayVar) {
        var actives = this.getAllActive();
        if (!effect && this.effect)
            effect = this.effect;
        this.speedSort(actives, function (a, b) { return b.speed - a.speed; });
        for (var _i = 0, actives_1 = actives; _i < actives_1.length; _i++) {
            var pokemon = actives_1[_i];
            this.runEvent(eventid, pokemon, null, effect, relayVar);
        }
        if (eventid === 'Weather' && this.gen >= 7) {
            // TODO: further research when updates happen
            this.eachEvent('Update');
        }
    };
    Battle.prototype.residualEvent = function (eventid, relayVar) {
        var _a;
        var callbackName = "on" + eventid;
        var handlers = this.findBattleEventHandlers(callbackName, 'duration');
        handlers = handlers.concat(this.findFieldEventHandlers(this.field, callbackName, 'duration'));
        for (var _i = 0, _b = this.sides; _i < _b.length; _i++) {
            var side = _b[_i];
            handlers = handlers.concat(this.findSideEventHandlers(side, callbackName, 'duration'));
            for (var _c = 0, _d = side.active; _c < _d.length; _c++) {
                var active = _d[_c];
                if (!active)
                    continue;
                handlers = handlers.concat(this.findPokemonEventHandlers(active, callbackName, 'duration'));
            }
        }
        this.speedSort(handlers);
        while (handlers.length) {
            var handler = handlers[0];
            handlers.shift();
            var status_1 = handler.status;
            if (handler.thing.fainted)
                continue;
            if (handler.statusData && handler.statusData.duration) {
                handler.statusData.duration--;
                if (!handler.statusData.duration) {
                    var endCallArgs = handler.endCallArgs || [handler.thing, status_1.id];
                    (_a = handler.end).call.apply(_a, endCallArgs);
                    continue;
                }
            }
            this.singleEvent(eventid, status_1, handler.statusData, handler.thing, relayVar);
            this.faintMessages();
            if (this.ended)
                return;
        }
    };
    /** The entire event system revolves around this function and runEvent. */
    Battle.prototype.singleEvent = function (eventid, effect, effectData, target, source, sourceEffect, relayVar) {
        if (this.eventDepth >= 8) {
            // oh fuck
            this.add('message', 'STACK LIMIT EXCEEDED');
            this.add('message', 'PLEASE REPORT IN BUG THREAD');
            this.add('message', 'Event: ' + eventid);
            this.add('message', 'Parent event: ' + this.event.id);
            throw new Error("Stack overflow");
        }
        // this.add('Event: ' + eventid + ' (depth ' + this.eventDepth + ')');
        var hasRelayVar = true;
        if (relayVar === undefined) {
            relayVar = true;
            hasRelayVar = false;
        }
        if (effect.effectType === 'Status' && (target instanceof pokemon_1.Pokemon) && target.status !== effect.id) {
            // it's changed; call it off
            return relayVar;
        }
        if (eventid !== 'Start' && eventid !== 'TakeItem' && eventid !== 'Primal' &&
            effect.effectType === 'Item' && (target instanceof pokemon_1.Pokemon) && target.ignoringItem()) {
            this.debug(eventid + ' handler suppressed by Embargo, Klutz or Magic Room');
            return relayVar;
        }
        if (eventid !== 'End' && effect.effectType === 'Ability' && (target instanceof pokemon_1.Pokemon) && target.ignoringAbility()) {
            this.debug(eventid + ' handler suppressed by Gastro Acid');
            return relayVar;
        }
        if (effect.effectType === 'Weather' && eventid !== 'Start' && eventid !== 'Residual' &&
            eventid !== 'End' && this.field.suppressingWeather()) {
            this.debug(eventid + ' handler suppressed by Air Lock');
            return relayVar;
        }
        // @ts-ignore - dynamic lookup
        var callback = effect["on" + eventid];
        if (callback === undefined)
            return relayVar;
        var parentEffect = this.effect;
        var parentEffectData = this.effectData;
        var parentEvent = this.event;
        this.effect = effect;
        this.effectData = effectData || {};
        this.event = { id: eventid, target: target, source: source, effect: sourceEffect };
        this.eventDepth++;
        var args = [target, source, sourceEffect];
        if (hasRelayVar)
            args.unshift(relayVar);
        var returnVal;
        if (typeof callback === 'function') {
            returnVal = callback.apply(this, args);
        }
        else {
            returnVal = callback;
        }
        this.eventDepth--;
        this.effect = parentEffect;
        this.effectData = parentEffectData;
        this.event = parentEvent;
        return returnVal === undefined ? relayVar : returnVal;
    };
    /**
     * runEvent is the core of Pokemon Showdown's event system.
     *
     * Basic usage
     * ===========
     *
     *   this.runEvent('Blah')
     * will trigger any onBlah global event handlers.
     *
     *   this.runEvent('Blah', target)
     * will additionally trigger any onBlah handlers on the target, onAllyBlah
     * handlers on any active pokemon on the target's team, and onFoeBlah
     * handlers on any active pokemon on the target's foe's team
     *
     *   this.runEvent('Blah', target, source)
     * will additionally trigger any onSourceBlah handlers on the source
     *
     *   this.runEvent('Blah', target, source, effect)
     * will additionally pass the effect onto all event handlers triggered
     *
     *   this.runEvent('Blah', target, source, effect, relayVar)
     * will additionally pass the relayVar as the first argument along all event
     * handlers
     *
     * You may leave any of these null. For instance, if you have a relayVar but
     * no source or effect:
     *   this.runEvent('Damage', target, null, null, 50)
     *
     * Event handlers
     * ==============
     *
     * Items, abilities, statuses, and other effects like SR, confusion, weather,
     * or Trick Room can have event handlers. Event handlers are functions that
     * can modify what happens during an event.
     *
     * event handlers are passed:
     *   function (target, source, effect)
     * although some of these can be blank.
     *
     * certain events have a relay variable, in which case they're passed:
     *   function (relayVar, target, source, effect)
     *
     * Relay variables are variables that give additional information about the
     * event. For instance, the damage event has a relayVar which is the amount
     * of damage dealt.
     *
     * If a relay variable isn't passed to runEvent, there will still be a secret
     * relayVar defaulting to `true`, but it won't get passed to any event
     * handlers.
     *
     * After an event handler is run, its return value helps determine what
     * happens next:
     * 1. If the return value isn't `undefined`, relayVar is set to the return
     *    value
     * 2. If relayVar is falsy, no more event handlers are run
     * 3. Otherwise, if there are more event handlers, the next one is run and
     *    we go back to step 1.
     * 4. Once all event handlers are run (or one of them results in a falsy
     *    relayVar), relayVar is returned by runEvent
     *
     * As a shortcut, an event handler that isn't a function will be interpreted
     * as a function that returns that value.
     *
     * You can have return values mean whatever you like, but in general, we
     * follow the convention that returning `false` or `null` means
     * stopping or interrupting the event.
     *
     * For instance, returning `false` from a TrySetStatus handler means that
     * the pokemon doesn't get statused.
     *
     * If a failed event usually results in a message like "But it failed!"
     * or "It had no effect!", returning `null` will suppress that message and
     * returning `false` will display it. Returning `null` is useful if your
     * event handler already gave its own custom failure message.
     *
     * Returning `undefined` means "don't change anything" or "keep going".
     * A function that does nothing but return `undefined` is the equivalent
     * of not having an event handler at all.
     *
     * Returning a value means that that value is the new `relayVar`. For
     * instance, if a Damage event handler returns 50, the damage event
     * will deal 50 damage instead of whatever it was going to deal before.
     *
     * Useful values
     * =============
     *
     * In addition to all the methods and attributes of Dex, Battle, and
     * Scripts, event handlers have some additional values they can access:
     *
     * this.effect:
     *   the Effect having the event handler
     * this.effectData:
     *   the data store associated with the above Effect. This is a plain Object
     *   and you can use it to store data for later event handlers.
     * this.effectData.target:
     *   the Pokemon, Side, or Battle that the event handler's effect was
     *   attached to.
     * this.event.id:
     *   the event ID
     * this.event.target, this.event.source, this.event.effect:
     *   the target, source, and effect of the event. These are the same
     *   variables that are passed as arguments to the event handler, but
     *   they're useful for functions called by the event handler.
     */
    Battle.prototype.runEvent = function (eventid, target, source, effect, relayVar, onEffect, fastExit) {
        // if (Battle.eventCounter) {
        // 	if (!Battle.eventCounter[eventid]) Battle.eventCounter[eventid] = 0;
        // 	Battle.eventCounter[eventid]++;
        // }
        if (this.eventDepth >= 8) {
            // oh fuck
            this.add('message', 'STACK LIMIT EXCEEDED');
            this.add('message', 'PLEASE REPORT IN BUG THREAD');
            this.add('message', 'Event: ' + eventid);
            this.add('message', 'Parent event: ' + this.event.id);
            throw new Error("Stack overflow");
        }
        if (!target)
            target = this;
        var effectSource = null;
        if (source instanceof pokemon_1.Pokemon)
            effectSource = source;
        var handlers = this.findEventHandlers(target, eventid, effectSource);
        if (eventid === 'Invulnerability' || eventid === 'TryHit' || eventid === 'AfterDamage') {
            handlers.sort(Battle.compareLeftToRightOrder);
        }
        else if (fastExit) {
            handlers.sort(Battle.compareRedirectOrder);
        }
        else {
            this.speedSort(handlers);
        }
        var hasRelayVar = 1;
        var args = [target, source, effect];
        // console.log('Event: ' + eventid + ' (depth ' + this.eventDepth + ') t:' + target.id + ' s:' + (!source || source.id) + ' e:' + effect.id);
        if (relayVar === undefined || relayVar === null) {
            relayVar = true;
            hasRelayVar = 0;
        }
        else {
            args.unshift(relayVar);
        }
        var parentEvent = this.event;
        this.event = { id: eventid, target: target, source: source, effect: effect, modifier: 1 };
        this.eventDepth++;
        if (onEffect) {
            if (!effect)
                throw new Error("onEffect passed without an effect");
            // @ts-ignore - dynamic lookup
            var callback = effect["on" + eventid];
            if (callback !== undefined) {
                handlers.unshift({ status: effect, callback: callback, statusData: {}, end: null, thing: target });
            }
        }
        var targetRelayVars = [];
        if (Array.isArray(target)) {
            if (Array.isArray(relayVar)) {
                targetRelayVars = relayVar;
            }
            else {
                for (var i = 0; i < target.length; i++)
                    targetRelayVars[i] = true;
            }
        }
        for (var _i = 0, handlers_1 = handlers; _i < handlers_1.length; _i++) {
            var handler = handlers_1[_i];
            if (handler.index !== undefined) {
                // TODO: find a better way to do this
                if (!targetRelayVars[handler.index] && !(targetRelayVars[handler.index] === 0 &&
                    eventid === 'AfterDamage'))
                    continue;
                if (handler.target) {
                    args[hasRelayVar] = handler.target;
                    this.event.target = handler.target;
                }
                if (hasRelayVar)
                    args[0] = targetRelayVars[handler.index];
            }
            var status_2 = handler.status;
            var thing = handler.thing;
            // this.debug('match ' + eventid + ': ' + status.id + ' ' + status.effectType);
            if (status_2.effectType === 'Status' && thing.status !== status_2.id) {
                // it's changed; call it off
                continue;
            }
            if (status_2.effectType === 'Ability' && !status_2.isUnbreakable &&
                this.suppressingAttackEvents() && this.activePokemon !== thing) {
                // ignore attacking events
                var AttackingEvents = {
                    BeforeMove: 1,
                    BasePower: 1,
                    Immunity: 1,
                    RedirectTarget: 1,
                    Heal: 1,
                    SetStatus: 1,
                    CriticalHit: 1,
                    ModifyAtk: 1, ModifyDef: 1, ModifySpA: 1, ModifySpD: 1, ModifySpe: 1, ModifyAccuracy: 1,
                    ModifyBoost: 1,
                    ModifyDamage: 1,
                    ModifySecondaries: 1,
                    ModifyWeight: 1,
                    TryAddVolatile: 1,
                    TryHit: 1,
                    TryHitSide: 1,
                    TryMove: 1,
                    Boost: 1,
                    DragOut: 1,
                    Effectiveness: 1
                };
                if (eventid in AttackingEvents) {
                    this.debug(eventid + ' handler suppressed by Mold Breaker');
                    continue;
                }
                else if (eventid === 'Damage' && effect && effect.effectType === 'Move') {
                    this.debug(eventid + ' handler suppressed by Mold Breaker');
                    continue;
                }
            }
            if (eventid !== 'Start' && eventid !== 'SwitchIn' && eventid !== 'TakeItem' &&
                status_2.effectType === 'Item' && (thing instanceof pokemon_1.Pokemon) && thing.ignoringItem()) {
                if (eventid !== 'Update') {
                    this.debug(eventid + ' handler suppressed by Embargo, Klutz or Magic Room');
                }
                continue;
            }
            else if (eventid !== 'End' && status_2.effectType === 'Ability' &&
                (thing instanceof pokemon_1.Pokemon) && thing.ignoringAbility()) {
                if (eventid !== 'Update') {
                    this.debug(eventid + ' handler suppressed by Gastro Acid');
                }
                continue;
            }
            if ((status_2.effectType === 'Weather' || eventid === 'Weather') &&
                eventid !== 'Residual' && eventid !== 'End' && this.field.suppressingWeather()) {
                this.debug(eventid + ' handler suppressed by Air Lock');
                continue;
            }
            var returnVal = void 0;
            if (typeof handler.callback === 'function') {
                var parentEffect = this.effect;
                var parentEffectData = this.effectData;
                this.effect = handler.status;
                this.effectData = handler.statusData || {};
                this.effectData.target = thing;
                returnVal = handler.callback.apply(this, args);
                this.effect = parentEffect;
                this.effectData = parentEffectData;
            }
            else {
                returnVal = handler.callback;
            }
            if (returnVal !== undefined) {
                relayVar = returnVal;
                if (!relayVar || fastExit) {
                    if (handler.index !== undefined) {
                        targetRelayVars[handler.index] = relayVar;
                        if (targetRelayVars.every(function (val) { return !val; }))
                            break;
                    }
                    else {
                        break;
                    }
                }
                if (hasRelayVar) {
                    args[0] = relayVar;
                }
            }
        }
        this.eventDepth--;
        if (typeof relayVar === 'number' && relayVar === Math.abs(Math.floor(relayVar))) {
            // this.debug(eventid + ' modifier: 0x' +
            // 	('0000' + (this.event.modifier * 4096).toString(16)).slice(-4).toUpperCase());
            relayVar = this.modify(relayVar, this.event.modifier);
        }
        this.event = parentEvent;
        return Array.isArray(target) ? targetRelayVars : relayVar;
    };
    /**
     * priorityEvent works just like runEvent, except it exits and returns
     * on the first non-undefined value instead of only on null/false.
     */
    Battle.prototype.priorityEvent = function (eventid, target, source, effect, relayVar, onEffect) {
        return this.runEvent(eventid, target, source, effect, relayVar, onEffect, true);
    };
    Battle.prototype.resolveLastPriority = function (handlers, callbackName) {
        var handler = handlers[handlers.length - 1];
        handler.order = handler.status[callbackName + "Order"] || false;
        handler.priority = handler.status[callbackName + "Priority"] || 0;
        handler.subOrder = handler.status[callbackName + "SubOrder"] || 0;
        if (handler.thing && handler.thing.getStat)
            handler.speed = handler.thing.speed;
    };
    Battle.prototype.findEventHandlers = function (thing, eventName, sourceThing) {
        var handlers = [];
        if (Array.isArray(thing)) {
            for (var _i = 0, _a = thing.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], i = _b[0], pokemon = _b[1];
                // console.log(`Event: ${eventName}, Target: ${'' + pokemon}, ${i}`);
                var curHandlers = this.findEventHandlers(pokemon, eventName, sourceThing);
                for (var _c = 0, curHandlers_1 = curHandlers; _c < curHandlers_1.length; _c++) {
                    var handler = curHandlers_1[_c];
                    handler.target = pokemon; // Original "thing"
                    handler.index = i;
                }
                handlers = handlers.concat(curHandlers);
            }
            return handlers;
        }
        if (thing instanceof pokemon_1.Pokemon && thing.isActive) {
            handlers = this.findPokemonEventHandlers(thing, "on" + eventName);
            for (var _d = 0, _e = thing.allies(); _d < _e.length; _d++) {
                var allyActive = _e[_d];
                handlers.push.apply(handlers, this.findPokemonEventHandlers(allyActive, "onAlly" + eventName));
                handlers.push.apply(handlers, this.findPokemonEventHandlers(allyActive, "onAny" + eventName));
            }
            for (var _f = 0, _g = thing.foes(); _f < _g.length; _f++) {
                var foeActive = _g[_f];
                handlers.push.apply(handlers, this.findPokemonEventHandlers(foeActive, "onFoe" + eventName));
                handlers.push.apply(handlers, this.findPokemonEventHandlers(foeActive, "onAny" + eventName));
            }
            thing = thing.side;
        }
        if (sourceThing) {
            handlers.push.apply(handlers, this.findPokemonEventHandlers(sourceThing, "onSource" + eventName));
        }
        if (thing instanceof side_1.Side) {
            var team = this.gameType === 'multi' ? thing.n % 2 : null;
            for (var _h = 0, _j = this.sides; _h < _j.length; _h++) {
                var side = _j[_h];
                if (team === null ? side === thing : side.n % 2 === team) {
                    handlers.push.apply(handlers, this.findSideEventHandlers(side, "on" + eventName));
                }
                else {
                    handlers.push.apply(handlers, this.findSideEventHandlers(side, "onFoe" + eventName));
                }
                handlers.push.apply(handlers, this.findSideEventHandlers(side, "onAny" + eventName));
            }
        }
        handlers.push.apply(handlers, this.findFieldEventHandlers(this.field, "on" + eventName));
        handlers.push.apply(handlers, this.findBattleEventHandlers("on" + eventName));
        return handlers;
    };
    Battle.prototype.findPokemonEventHandlers = function (pokemon, callbackName, getKey) {
        var handlers = [];
        var status = pokemon.getStatus();
        // @ts-ignore - dynamic lookup
        var callback = status[callbackName];
        if (callback !== undefined || (getKey && pokemon.statusData[getKey])) {
            handlers.push({
                status: status, callback: callback, statusData: pokemon.statusData, end: pokemon.clearStatus, thing: pokemon
            });
            this.resolveLastPriority(handlers, callbackName);
        }
        for (var i in pokemon.volatiles) {
            var volatileData = pokemon.volatiles[i];
            var volatile = pokemon.getVolatile(i);
            // @ts-ignore - dynamic lookup
            callback = volatile[callbackName];
            if (callback !== undefined || (getKey && volatileData[getKey])) {
                handlers.push({
                    status: volatile, callback: callback, statusData: volatileData, end: pokemon.removeVolatile, thing: pokemon
                });
                this.resolveLastPriority(handlers, callbackName);
            }
        }
        var ability = pokemon.getAbility();
        // @ts-ignore - dynamic lookup
        callback = ability[callbackName];
        if (callback !== undefined || (getKey && pokemon.abilityData[getKey])) {
            handlers.push({
                status: ability, callback: callback, statusData: pokemon.abilityData, end: pokemon.clearAbility, thing: pokemon
            });
            this.resolveLastPriority(handlers, callbackName);
        }
        var item = pokemon.getItem();
        // @ts-ignore - dynamic lookup
        callback = item[callbackName];
        if (callback !== undefined || (getKey && pokemon.itemData[getKey])) {
            handlers.push({
                status: item, callback: callback, statusData: pokemon.itemData, end: pokemon.clearItem, thing: pokemon
            });
            this.resolveLastPriority(handlers, callbackName);
        }
        var species = pokemon.baseTemplate;
        // @ts-ignore - dynamic lookup
        callback = species[callbackName];
        if (callback !== undefined) {
            handlers.push({
                status: species, callback: callback, statusData: pokemon.speciesData, end: function () { }, thing: pokemon
            });
            this.resolveLastPriority(handlers, callbackName);
        }
        var side = pokemon.side;
        for (var conditionid in side.slotConditions[pokemon.position]) {
            var slotConditionData = side.slotConditions[pokemon.position][conditionid];
            var slotCondition = side.getSlotCondition(pokemon, conditionid);
            // @ts-ignore - dynamic lookup
            callback = slotCondition[callbackName];
            if (callback !== undefined || (getKey && slotConditionData[getKey])) {
                handlers.push({
                    status: slotCondition,
                    callback: callback,
                    statusData: slotConditionData,
                    end: side.removeSlotCondition,
                    endCallArgs: [side, pokemon, slotCondition.id],
                    thing: side
                });
                this.resolveLastPriority(handlers, callbackName);
            }
        }
        return handlers;
    };
    Battle.prototype.findBattleEventHandlers = function (callbackName, getKey) {
        var callbackNamePriority = callbackName + "Priority";
        var handlers = [];
        var callback;
        var format = this.format;
        // @ts-ignore - dynamic lookup
        callback = format[callbackName];
        // @ts-ignore - dynamic lookup
        if (callback !== undefined || (getKey && this.formatData[getKey])) {
            handlers.push({
                status: format, callback: callback, statusData: this.formatData, end: function () { }, thing: this,
                // @ts-ignore - dynamic lookup
                priority: format[callbackNamePriority] || 0
            });
            this.resolveLastPriority(handlers, callbackName);
        }
        // tslint:disable-next-line:no-conditional-assignment
        if (this.events && (callback = this.events[callbackName]) !== undefined) {
            for (var _i = 0, callback_1 = callback; _i < callback_1.length; _i++) {
                var handler = callback_1[_i];
                var statusData = (handler.target.effectType === 'Format') ? this.formatData : undefined;
                handlers.push({
                    status: handler.target, callback: handler.callback, statusData: statusData, end: function () { },
                    thing: this, priority: handler.priority, order: handler.order, subOrder: handler.subOrder
                });
            }
        }
        return handlers;
    };
    Battle.prototype.findFieldEventHandlers = function (field, callbackName, getKey) {
        var callbackNamePriority = callbackName + "Priority";
        var handlers = [];
        var callback;
        for (var i in field.pseudoWeather) {
            var pseudoWeatherData = field.pseudoWeather[i];
            var pseudoWeather = field.getPseudoWeather(i);
            // @ts-ignore - dynamic lookup
            callback = pseudoWeather[callbackName];
            if (callback !== undefined || (getKey && pseudoWeatherData[getKey])) {
                handlers.push({
                    status: pseudoWeather, callback: callback, statusData: pseudoWeatherData, end: field.removePseudoWeather, thing: field
                });
                this.resolveLastPriority(handlers, callbackName);
            }
        }
        var weather = field.getWeather();
        // @ts-ignore - dynamic lookup
        callback = weather[callbackName];
        if (callback !== undefined || (getKey && this.field.weatherData[getKey])) {
            handlers.push({
                status: weather, callback: callback, statusData: this.field.weatherData, end: field.clearWeather, thing: field,
                // @ts-ignore - dynamic lookup
                priority: weather[callbackNamePriority] || 0
            });
            this.resolveLastPriority(handlers, callbackName);
        }
        var terrain = field.getTerrain();
        // @ts-ignore - dynamic lookup
        callback = terrain[callbackName];
        if (callback !== undefined || (getKey && field.terrainData[getKey])) {
            handlers.push({
                status: terrain, callback: callback, statusData: field.terrainData, end: field.clearTerrain, thing: field,
                // @ts-ignore - dynamic lookup
                priority: terrain[callbackNamePriority] || 0
            });
            this.resolveLastPriority(handlers, callbackName);
        }
        return handlers;
    };
    Battle.prototype.findSideEventHandlers = function (side, callbackName, getKey) {
        var handlers = [];
        for (var i in side.sideConditions) {
            var sideConditionData = side.sideConditions[i];
            var sideCondition = side.getSideCondition(i);
            // @ts-ignore - dynamic lookup
            var callback = sideCondition[callbackName];
            if (callback !== undefined || (getKey && sideConditionData[getKey])) {
                handlers.push({
                    status: sideCondition, callback: callback, statusData: sideConditionData, end: side.removeSideCondition, thing: side
                });
                this.resolveLastPriority(handlers, callbackName);
            }
        }
        return handlers;
    };
    /**
     * Use this function to attach custom event handlers to a battle. See Battle#runEvent for
     * more information on how to write callbacks for event handlers.
     *
     * Try to use this sparingly. Most event handlers can be simply placed in a format instead.
     *
     *     this.onEvent(eventid, target, callback)
     * will set the callback as an event handler for the target when eventid is called with the
     * default priority. Currently only valid formats are supported as targets but this will
     * eventually be expanded to support other target types.
     *
     *     this.onEvent(eventid, target, priority, callback)
     * will set the callback as an event handler for the target when eventid is called with the
     * provided priority. Priority can either be a number or an object that contains the priority,
     * order, and subOrder for the event handler as needed (undefined keys will use default values)
     */
    Battle.prototype.onEvent = function (eventid, target) {
        var rest = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            rest[_i - 2] = arguments[_i];
        }
        if (!eventid)
            throw new TypeError("Event handlers must have an event to listen to");
        if (!target)
            throw new TypeError("Event handlers must have a target");
        if (!rest.length)
            throw new TypeError("Event handlers must have a callback");
        if (target.effectType !== 'Format') {
            throw new TypeError(target.name + " is a " + target.effectType + " but only Format targets are supported right now");
        }
        // tslint:disable-next-line:one-variable-per-declaration
        var callback, priority, order, subOrder, data;
        if (rest.length === 1) {
            callback = rest[0];
            priority = 0;
            order = false;
            subOrder = 0;
        }
        else {
            data = rest[0], callback = rest[1];
            if (typeof data === 'object') {
                priority = data['priority'] || 0;
                order = data['order'] || false;
                subOrder = data['subOrder'] || 0;
            }
            else {
                priority = data || 0;
                order = false;
                subOrder = 0;
            }
        }
        var eventHandler = { callback: callback, target: target, priority: priority, order: order, subOrder: subOrder };
        if (!this.events)
            this.events = {};
        var callbackName = "on" + eventid;
        var eventHandlers = this.events[callbackName];
        if (eventHandlers === undefined) {
            this.events[callbackName] = [eventHandler];
        }
        else {
            eventHandlers.push(eventHandler);
        }
    };
    Battle.prototype.getPokemon = function (id) {
        if (typeof id !== 'string')
            id = id.id;
        for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
            var side = _a[_i];
            for (var _b = 0, _c = side.pokemon; _b < _c.length; _b++) {
                var pokemon = _c[_b];
                if (pokemon.id === id)
                    return pokemon;
            }
        }
        return null;
    };
    Battle.prototype.getAllPokemon = function () {
        var pokemonList = [];
        for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
            var side = _a[_i];
            pokemonList.push.apply(pokemonList, side.pokemon);
        }
        return pokemonList;
    };
    Battle.prototype.getAllActive = function () {
        var pokemonList = [];
        for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
            var side = _a[_i];
            for (var _b = 0, _c = side.active; _b < _c.length; _b++) {
                var pokemon = _c[_b];
                if (pokemon && !pokemon.fainted) {
                    pokemonList.push(pokemon);
                }
            }
        }
        return pokemonList;
    };
    Battle.prototype.makeRequest = function (type) {
        if (type) {
            this.requestState = type;
            for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
                var side = _a[_i];
                side.clearChoice();
            }
        }
        else {
            type = this.requestState;
        }
        for (var _b = 0, _c = this.sides; _b < _c.length; _b++) {
            var side = _c[_b];
            side.activeRequest = null;
        }
        var maxTeamSize = this.getMaxTeamSize();
        if (type === 'teampreview') {
            this.add('teampreview' + (maxTeamSize !== 6 ? '|' + maxTeamSize : ''));
        }
        var requests = this.getRequests(type, maxTeamSize);
        for (var i = 0; i < this.sides.length; i++) {
            this.sides[i].emitRequest(requests[i]);
        }
        if (this.sides.every(function (side) { return side.isChoiceDone(); })) {
            throw new Error("Choices are done immediately after a request");
        }
    };
    Battle.prototype.getMaxTeamSize = function () {
        var teamLengthData = this.format.teamLength;
        return (teamLengthData && teamLengthData.battle) || 6;
    };
    Battle.prototype.getRequests = function (type, maxTeamSize) {
        // default to no request
        var requests = Array(this.sides.length).fill(null);
        switch (type) {
            case 'switch': {
                for (var i = 0; i < this.sides.length; i++) {
                    var side = this.sides[i];
                    var switchTable = [];
                    for (var _i = 0, _a = side.active; _i < _a.length; _i++) {
                        var pokemon = _a[_i];
                        switchTable.push(!!(pokemon && pokemon.switchFlag));
                    }
                    if (switchTable.some(function (flag) { return flag === true; })) {
                        requests[i] = { forceSwitch: switchTable, side: side.getRequestData() };
                    }
                }
                break;
            }
            case 'teampreview':
                for (var i = 0; i < this.sides.length; i++) {
                    var side = this.sides[i];
                    side.maxTeamSize = maxTeamSize;
                    requests[i] = { teamPreview: true, maxTeamSize: maxTeamSize, side: side.getRequestData() };
                }
                break;
            default: {
                for (var i = 0; i < this.sides.length; i++) {
                    var side = this.sides[i];
                    var activeData = side.active.map(function (pokemon) { return pokemon && pokemon.getRequestData(); });
                    requests[i] = { active: activeData, side: side.getRequestData() };
                }
                break;
            }
        }
        var allRequestsMade = requests.every(function (request) { return request; });
        for (var i = 0; i < this.sides.length; i++) {
            if (requests[i]) {
                if (!this.supportCancel || !allRequestsMade)
                    requests[i].noCancel = true;
            }
            else {
                requests[i] = { wait: true, side: this.sides[i].getRequestData() };
            }
        }
        return requests;
    };
    Battle.prototype.tiebreak = function () {
        if (this.ended)
            return false;
        this.inputLog.push(">tiebreak");
        this.add('message', "Time's up! Going to tiebreaker...");
        var notFainted = this.sides.map(function (side) { return (side.pokemon.filter(function (pokemon) { return !pokemon.fainted; }).length); });
        this.add('-message', this.sides.map(function (side, i) { return (side.name + ": " + notFainted[i] + " Pokemon left"); }).join('; '));
        var maxNotFainted = Math.max.apply(Math, notFainted);
        var tiedSides = this.sides.filter(function (side, i) { return notFainted[i] === maxNotFainted; });
        if (tiedSides.length <= 1) {
            return this.win(tiedSides[0]);
        }
        var hpPercentage = tiedSides.map(function (side) { return (side.pokemon.map(function (pokemon) { return pokemon.hp / pokemon.maxhp; }).reduce(function (a, b) { return a + b; }) * 100 / 6); });
        this.add('-message', tiedSides.map(function (side, i) { return (side.name + ": " + Math.round(hpPercentage[i]) + "% total HP left"); }).join('; '));
        var maxPercentage = Math.max.apply(Math, hpPercentage);
        tiedSides = tiedSides.filter(function (side, i) { return hpPercentage[i] === maxPercentage; });
        if (tiedSides.length <= 1) {
            return this.win(tiedSides[0]);
        }
        var hpTotal = tiedSides.map(function (side) { return (side.pokemon.map(function (pokemon) { return pokemon.hp; }).reduce(function (a, b) { return a + b; })); });
        this.add('-message', tiedSides.map(function (side, i) { return (side.name + ": " + Math.round(hpTotal[i]) + " total HP left"); }).join('; '));
        var maxTotal = Math.max.apply(Math, hpTotal);
        tiedSides = tiedSides.filter(function (side, i) { return hpTotal[i] === maxTotal; });
        if (tiedSides.length <= 1) {
            return this.win(tiedSides[0]);
        }
        return this.tie();
    };
    Battle.prototype.forceWin = function (side) {
        if (side === void 0) { side = null; }
        if (this.ended)
            return false;
        this.inputLog.push(side ? ">forcewin " + side : ">forcetie");
        return this.win(side);
    };
    Battle.prototype.tie = function () {
        return this.win();
    };
    Battle.prototype.win = function (side) {
        if (this.ended)
            return false;
        if (side && typeof side === 'string') {
            side = this.getSide(side);
        }
        else if (!side || !this.sides.includes(side)) {
            side = null;
        }
        this.winner = side ? side.name : '';
        this.add('');
        if (side) {
            this.add('win', side.name);
        }
        else {
            this.add('tie');
        }
        this.ended = true;
        this.requestState = '';
        for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
            var s = _a[_i];
            s.activeRequest = null;
        }
        return true;
    };
    Battle.prototype.switchIn = function (pokemon, pos, sourceEffect) {
        if (sourceEffect === void 0) { sourceEffect = null; }
        if (!pokemon || pokemon.isActive)
            return false;
        if (!pos)
            pos = 0;
        var side = pokemon.side;
        if (pos >= side.active.length) {
            throw new Error("Invalid switch position");
        }
        var newMove = null;
        if (side.active[pos]) {
            var oldActive = side.active[pos];
            if (this.gen === 4 && sourceEffect) {
                newMove = oldActive.lastMove;
            }
            this.cancelMove(oldActive);
            if (oldActive.switchCopyFlag) {
                oldActive.switchCopyFlag = false;
                pokemon.copyVolatileFrom(oldActive);
            }
        }
        if (newMove)
            pokemon.lastMove = newMove;
        pokemon.isActive = true;
        this.runEvent('BeforeSwitchIn', pokemon);
        if (side.active[pos]) {
            var oldActive = side.active[pos];
            oldActive.isActive = false;
            oldActive.isStarted = false;
            oldActive.usedItemThisTurn = false;
            oldActive.position = pokemon.position;
            pokemon.position = pos;
            side.pokemon[pokemon.position] = pokemon;
            side.pokemon[oldActive.position] = oldActive;
            this.cancelMove(oldActive);
            oldActive.clearVolatile();
        }
        side.active[pos] = pokemon;
        pokemon.activeTurns = 0;
        for (var _i = 0, _a = pokemon.moveSlots; _i < _a.length; _i++) {
            var moveSlot = _a[_i];
            moveSlot.used = false;
        }
        this.add('switch', pokemon, pokemon.getDetails);
        if (sourceEffect)
            this.log[this.log.length - 1] += "|[from]" + sourceEffect.fullname;
        this.insertQueue({ pokemon: pokemon, choice: 'runUnnerve' });
        this.insertQueue({ pokemon: pokemon, choice: 'runSwitch' });
    };
    Battle.prototype.canSwitch = function (side) {
        return this.possibleSwitches(side).length;
    };
    Battle.prototype.getRandomSwitchable = function (side) {
        var canSwitchIn = this.possibleSwitches(side);
        return canSwitchIn.length ? this.sample(canSwitchIn) : null;
    };
    Battle.prototype.possibleSwitches = function (side) {
        var canSwitchIn = [];
        for (var i = side.active.length; i < side.pokemon.length; i++) {
            var pokemon = side.pokemon[i];
            if (!pokemon.fainted) {
                canSwitchIn.push(pokemon);
            }
        }
        return canSwitchIn;
    };
    Battle.prototype.dragIn = function (side, pos) {
        if (!pos)
            pos = 0;
        if (pos >= side.active.length)
            return false;
        var pokemon = this.getRandomSwitchable(side);
        if (!pokemon || pokemon.isActive)
            return false;
        pokemon.isActive = true;
        this.runEvent('BeforeSwitchIn', pokemon);
        if (side.active[pos]) {
            var oldActive = side.active[pos];
            if (!oldActive.hp) {
                return false;
            }
            if (!this.runEvent('DragOut', oldActive)) {
                return false;
            }
            this.runEvent('SwitchOut', oldActive);
            oldActive.illusion = null;
            this.singleEvent('End', this.dex.getAbility(oldActive.ability), oldActive.abilityData, oldActive);
            oldActive.isActive = false;
            oldActive.isStarted = false;
            oldActive.usedItemThisTurn = false;
            oldActive.position = pokemon.position;
            pokemon.position = pos;
            side.pokemon[pokemon.position] = pokemon;
            side.pokemon[oldActive.position] = oldActive;
            this.cancelMove(oldActive);
            oldActive.clearVolatile();
        }
        side.active[pos] = pokemon;
        pokemon.activeTurns = 0;
        if (this.gen === 2)
            pokemon.draggedIn = this.turn;
        for (var _i = 0, _a = pokemon.moveSlots; _i < _a.length; _i++) {
            var moveSlot = _a[_i];
            moveSlot.used = false;
        }
        this.add('drag', pokemon, pokemon.getDetails);
        if (this.gen >= 5) {
            this.singleEvent('PreStart', pokemon.getAbility(), pokemon.abilityData, pokemon);
            this.runEvent('SwitchIn', pokemon);
            if (!pokemon.hp)
                return true;
            pokemon.isStarted = true;
            if (!pokemon.fainted) {
                this.singleEvent('Start', pokemon.getAbility(), pokemon.abilityData, pokemon);
                this.singleEvent('Start', pokemon.getItem(), pokemon.itemData, pokemon);
            }
        }
        else {
            this.insertQueue({ pokemon: pokemon, choice: 'runSwitch' });
        }
        return true;
    };
    Battle.prototype.swapPosition = function (pokemon, slot, attributes) {
        if (slot >= pokemon.side.active.length) {
            throw new Error("Invalid swap position");
        }
        var target = pokemon.side.active[slot];
        if (slot !== 1 && (!target || target.fainted))
            return false;
        this.add('swap', pokemon, slot, attributes || '');
        var side = pokemon.side;
        side.pokemon[pokemon.position] = target;
        side.pokemon[slot] = pokemon;
        side.active[pokemon.position] = side.pokemon[pokemon.position];
        side.active[slot] = side.pokemon[slot];
        if (target)
            target.position = pokemon.position;
        pokemon.position = slot;
        return true;
    };
    Battle.prototype.faint = function (pokemon, source, effect) {
        pokemon.faint(source, effect);
    };
    Battle.prototype.nextTurn = function () {
        this.turn++;
        this.lastMoveThisTurn = null;
        var trappedBySide = [];
        var stalenessBySide = [];
        for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
            var side = _a[_i];
            var sideTrapped = true;
            var sideStaleness = void 0;
            for (var _b = 0, _c = side.active; _b < _c.length; _b++) {
                var pokemon = _c[_b];
                if (!pokemon)
                    continue;
                pokemon.moveThisTurn = '';
                pokemon.usedItemThisTurn = false;
                pokemon.newlySwitched = false;
                pokemon.moveLastTurnResult = pokemon.moveThisTurnResult;
                pokemon.moveThisTurnResult = undefined;
                pokemon.hurtThisTurn = false;
                pokemon.maybeDisabled = false;
                for (var _d = 0, _e = pokemon.moveSlots; _d < _e.length; _d++) {
                    var moveSlot = _e[_d];
                    moveSlot.disabled = false;
                    moveSlot.disabledSource = '';
                }
                this.runEvent('DisableMove', pokemon);
                if (!pokemon.ateBerry)
                    pokemon.disableMove('belch');
                // If it was an illusion, it's not any more
                if (pokemon.getLastAttackedBy() && this.gen >= 7)
                    pokemon.knownType = true;
                for (var i = pokemon.attackedBy.length - 1; i >= 0; i--) {
                    var attack = pokemon.attackedBy[i];
                    if (attack.source.isActive) {
                        attack.thisTurn = false;
                    }
                    else {
                        pokemon.attackedBy.splice(pokemon.attackedBy.indexOf(attack), 1);
                    }
                }
                if (this.gen >= 7) {
                    // In Gen 7, the real type of every Pokemon is visible to all players via the bottom screen while making choices
                    var seenPokemon = pokemon.illusion || pokemon;
                    var realTypeString = seenPokemon.getTypes(true).join('/');
                    if (realTypeString !== seenPokemon.apparentType) {
                        this.add('-start', pokemon, 'typechange', realTypeString, '[silent]');
                        seenPokemon.apparentType = realTypeString;
                        if (pokemon.addedType) {
                            // The typechange message removes the added type, so put it back
                            this.add('-start', pokemon, 'typeadd', pokemon.addedType, '[silent]');
                        }
                    }
                }
                pokemon.trapped = pokemon.maybeTrapped = false;
                this.runEvent('TrapPokemon', pokemon);
                if (!pokemon.knownType || this.dex.getImmunity('trapped', pokemon)) {
                    this.runEvent('MaybeTrapPokemon', pokemon);
                }
                // canceling switches would leak information
                // if a foe might have a trapping ability
                if (this.gen > 2) {
                    for (var _f = 0, _g = pokemon.side.foe.active; _f < _g.length; _f++) {
                        var source = _g[_f];
                        if (!source || source.fainted)
                            continue;
                        var template = (source.illusion || source).template;
                        if (!template.abilities)
                            continue;
                        for (var abilitySlot in template.abilities) {
                            var abilityName = template.abilities[abilitySlot];
                            if (abilityName === source.ability) {
                                // pokemon event was already run above so we don't need
                                // to run it again.
                                continue;
                            }
                            var ruleTable = this.ruleTable;
                            if ((ruleTable.has('+hackmons') || !ruleTable.has('obtainableabilities')) && !this.format.team) {
                                // hackmons format
                                continue;
                            }
                            else if (abilitySlot === 'H' && template.unreleasedHidden) {
                                // unreleased hidden ability
                                continue;
                            }
                            var ability = this.dex.getAbility(abilityName);
                            if (ruleTable.has('-ability:' + ability.id))
                                continue;
                            if (pokemon.knownType && !this.dex.getImmunity('trapped', pokemon))
                                continue;
                            this.singleEvent('FoeMaybeTrapPokemon', ability, {}, pokemon, source);
                        }
                    }
                }
                if (pokemon.fainted)
                    continue;
                sideTrapped = sideTrapped && pokemon.trapped;
                if (pokemon.staleness) {
                    sideStaleness = sideStaleness === 'external' ? sideStaleness : pokemon.staleness;
                }
                pokemon.activeTurns++;
            }
            trappedBySide.push(sideTrapped);
            stalenessBySide.push(sideStaleness);
            side.faintedLastTurn = side.faintedThisTurn;
            side.faintedThisTurn = false;
        }
        if (this.maybeTriggerEndlessBattleClause(trappedBySide, stalenessBySide))
            return;
        if (this.gameType === 'triples' && !this.sides.filter(function (side) { return side.pokemonLeft > 1; }).length) {
            // If both sides have one Pokemon left in triples and they are not adjacent, they are both moved to the center.
            var actives = this.getAllActive();
            if (actives.length > 1 && !this.isAdjacent(actives[0], actives[1])) {
                this.swapPosition(actives[0], 1, '[silent]');
                this.swapPosition(actives[1], 1, '[silent]');
                this.add('-center');
            }
        }
        this.add('turn', this.turn);
        this.makeRequest('move');
    };
    Battle.prototype.maybeTriggerEndlessBattleClause = function (trappedBySide, stalenessBySide) {
        if (!this.ruleTable.has('endlessbattleclause'))
            return;
        if ((this.turn >= 500 && this.turn % 100 === 0) ||
            (this.turn >= 900 && this.turn % 10 === 0) ||
            (this.turn >= 990)) {
            var turnsLeft = 1000 - this.turn;
            if (turnsLeft < 0) {
                this.add('message', "It is turn 1000. Endless Battle Clause activated!");
                this.tie();
                return true;
            }
            var turnsLeftText = (turnsLeft === 1 ? "1 turn" : turnsLeft + " turns");
            this.add('bigerror', "You will auto-tie if the battle doesn't end in " + turnsLeftText + " (on turn 1000).");
            if (Config.allowrequestingties)
                this.hint("If you want to tie earlier, consider using `/offertie`.");
        }
        // Are all Pokemon on every side stale, with at least one side containing an externally stale Pokemon?
        if (!stalenessBySide.every(function (s) { return !!s; }) || !stalenessBySide.some(function (s) { return s === 'external'; }))
            return;
        // Can both sides switch to a non-stale Pokemon?
        var canSwitch = [];
        for (var _i = 0, _a = trappedBySide.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], trapped = _b[1];
            canSwitch[i] = false;
            if (trapped)
                break;
            var side = this.sides[i];
            for (var _c = 0, _d = side.pokemon; _c < _d.length; _c++) {
                var pokemon = _d[_c];
                if (!pokemon.fainted && !pokemon.staleness) {
                    canSwitch[i] = true;
                    break;
                }
            }
        }
        if (canSwitch.every(function (s) { return s; }))
            return;
        // Endless Battle Clause activates - we determine the winner by looking at each side's sets.
        var losers = [];
        for (var _e = 0, _f = this.sides; _e < _f.length; _e++) {
            var side = _f[_e];
            var leppa = false; // Leppa Berry
            var cycle = false; // Harvest or Recycle
            for (var _g = 0, _h = side.pokemon; _g < _h.length; _g++) {
                var pokemon = _h[_g];
                if (toID(pokemon.set.item) === 'leppaberry')
                    leppa = true;
                if (['harvest', 'pickup'].includes(toID(pokemon.set.ability)) ||
                    pokemon.set.moves.map(toID).includes('recycle')) {
                    cycle = true;
                }
                if (leppa && cycle)
                    break;
            }
            if (leppa && cycle)
                losers.push(side);
        }
        if (losers.length === 1) {
            var loser = losers[0];
            this.add('-message', loser.name + "'s team started with the rudimentary means to perform Leppa Berry cycling and thus loses.");
            return this.win(loser.foe);
        }
        if (losers.length === this.sides.length) {
            this.add('-message', "Each side's team started with the rudimentary means to perform Leppa Berry cycling.");
        }
        return this.tie();
    };
    Battle.prototype.start = function () {
        // deserialized should use restart instead
        if (this.deserialized)
            return;
        // need all players to start
        if (!this.sides.every(function (side) { return !!side; }))
            return;
        if (this.started)
            return;
        this.started = true;
        this.sides[1].foe = this.sides[0];
        this.sides[0].foe = this.sides[1];
        for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
            var side = _a[_i];
            this.add('teamsize', side.id, side.pokemon.length);
        }
        this.add('gametype', this.gameType);
        this.add('gen', this.gen);
        var format = this.format;
        this.add('tier', format.name);
        if (this.rated) {
            if (this.rated === 'Rated battle')
                this.rated = true;
            this.add('rated', typeof this.rated === 'string' ? this.rated : '');
        }
        if (format.onBegin)
            format.onBegin.call(this);
        if (format.trunc)
            this.trunc = format.trunc;
        for (var _b = 0, _c = this.ruleTable.keys(); _b < _c.length; _b++) {
            var rule = _c[_b];
            if (rule.startsWith('+') || rule.startsWith('-') || rule.startsWith('!'))
                continue;
            var subFormat = this.dex.getFormat(rule);
            if (subFormat.exists) {
                if (subFormat.onBegin)
                    subFormat.onBegin.call(this);
            }
        }
        if (this.sides.some(function (side) { return !side.pokemon[0]; })) {
            throw new Error('Battle not started: A player has an empty team.');
        }
        this.residualEvent('TeamPreview');
        this.addToQueue({ choice: 'start' });
        this.midTurn = true;
        if (!this.requestState)
            this.go();
    };
    Battle.prototype.restart = function (send) {
        if (!this.deserialized)
            throw new Error('Attempt to restart a battle which has not been deserialized');
        if (this.format.trunc)
            this.trunc = this.format.trunc;
        // @ts-ignore - readonly
        this.send = send;
    };
    Battle.prototype.boost = function (boost, target, source, effect, isSecondary, isSelf) {
        if (target === void 0) { target = null; }
        if (source === void 0) { source = null; }
        if (effect === void 0) { effect = null; }
        if (isSecondary === void 0) { isSecondary = false; }
        if (isSelf === void 0) { isSelf = false; }
        if (this.event) {
            if (!target)
                target = this.event.target;
            if (!source)
                source = this.event.source;
            if (!effect)
                effect = this.effect;
        }
        if (!target || !target.hp)
            return 0;
        if (!target.isActive)
            return false;
        if (this.gen > 5 && !target.side.foe.pokemonLeft)
            return false;
        boost = this.runEvent('Boost', target, source, effect, Object.assign({}, boost));
        var success = null;
        var boosted = isSecondary;
        var boostName;
        for (boostName in boost) {
            var currentBoost = {};
            currentBoost[boostName] = boost[boostName];
            var boostBy = target.boostBy(currentBoost);
            var msg = '-boost';
            if (boost[boostName] < 0) {
                msg = '-unboost';
                boostBy = -boostBy;
            }
            if (boostBy) {
                success = true;
                switch (effect && effect.id) {
                    case 'bellydrum':
                        this.add('-setboost', target, 'atk', target.boosts['atk'], '[from] move: Belly Drum');
                        break;
                    case 'bellydrum2':
                        this.add(msg, target, boostName, boostBy, '[silent]');
                        this.hint("In Gen 2, Belly Drum boosts by 2 when it fails.");
                        break;
                    case 'zpower':
                        this.add(msg, target, boostName, boostBy, '[zeffect]');
                        break;
                    default:
                        if (!effect)
                            break;
                        if (effect.effectType === 'Move') {
                            this.add(msg, target, boostName, boostBy);
                        }
                        else {
                            if (effect.effectType === 'Ability' && !boosted) {
                                this.add('-ability', target, effect.name, 'boost');
                                boosted = true;
                            }
                            this.add(msg, target, boostName, boostBy);
                        }
                        break;
                }
                this.runEvent('AfterEachBoost', target, source, effect, currentBoost);
            }
            else if (effect && effect.effectType === 'Ability') {
                if (isSecondary)
                    this.add(msg, target, boostName, boostBy);
            }
            else if (!isSecondary && !isSelf) {
                this.add(msg, target, boostName, boostBy);
            }
        }
        this.runEvent('AfterBoost', target, source, effect, boost);
        return success;
    };
    Battle.prototype.spreadDamage = function (damage, targetArray, source, effect, instafaint) {
        if (targetArray === void 0) { targetArray = null; }
        if (source === void 0) { source = null; }
        if (effect === void 0) { effect = null; }
        if (instafaint === void 0) { instafaint = false; }
        if (!targetArray)
            return [0];
        var retVals = [];
        if (typeof effect === 'string' || !effect)
            effect = this.dex.getEffectByID((effect || ''));
        for (var _i = 0, _a = damage.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], curDamage = _b[1];
            var target = targetArray[i];
            var targetDamage = curDamage;
            if (!(targetDamage || targetDamage === 0)) {
                retVals[i] = targetDamage;
                continue;
            }
            if (!target || !target.hp) {
                retVals[i] = 0;
                continue;
            }
            if (!target.isActive) {
                retVals[i] = false;
                continue;
            }
            if (targetDamage !== 0)
                targetDamage = this.dex.clampIntRange(targetDamage, 1);
            if (effect.id !== 'struggle-recoil') { // Struggle recoil is not affected by effects
                if (effect.effectType === 'Weather' && !target.runStatusImmunity(effect.id)) {
                    this.debug('weather immunity');
                    retVals[i] = 0;
                    continue;
                }
                targetDamage = this.runEvent('Damage', target, source, effect, targetDamage);
                if (!(targetDamage || targetDamage === 0)) {
                    this.debug('damage event failed');
                    retVals[i] = curDamage === true ? undefined : targetDamage;
                    continue;
                }
            }
            if (targetDamage !== 0)
                targetDamage = this.dex.clampIntRange(targetDamage, 1);
            if (this.gen <= 1) {
                if (this.dex.currentMod === 'stadium' ||
                    !['recoil', 'drain'].includes(effect.id) && effect.effectType !== 'Status') {
                    this.lastDamage = targetDamage;
                }
            }
            retVals[i] = targetDamage = target.damage(targetDamage, source, effect);
            if (targetDamage !== 0)
                target.hurtThisTurn = true;
            if (source && effect.effectType === 'Move')
                source.lastDamage = targetDamage;
            var name_1 = effect.fullname === 'tox' ? 'psn' : effect.fullname;
            switch (effect.id) {
                case 'partiallytrapped':
                    this.add('-damage', target, target.getHealth, '[from] ' + this.effectData.sourceEffect.fullname, '[partiallytrapped]');
                    break;
                case 'powder':
                    this.add('-damage', target, target.getHealth, '[silent]');
                    break;
                case 'confused':
                    this.add('-damage', target, target.getHealth, '[from] confusion');
                    break;
                default:
                    if (effect.effectType === 'Move' || !name_1) {
                        this.add('-damage', target, target.getHealth);
                    }
                    else if (source && (source !== target || effect.effectType === 'Ability')) {
                        this.add('-damage', target, target.getHealth, '[from] ' + name_1, '[of] ' + source);
                    }
                    else {
                        this.add('-damage', target, target.getHealth, '[from] ' + name_1);
                    }
                    break;
            }
            if (targetDamage && effect.effectType === 'Move') {
                if (this.gen <= 1 && effect.recoil && source) {
                    var amount = this.dex.clampIntRange(Math.floor(targetDamage * effect.recoil[0] / effect.recoil[1]), 1);
                    this.damage(amount, source, target, 'recoil');
                }
                if (this.gen <= 4 && effect.drain && source) {
                    var amount = this.dex.clampIntRange(Math.floor(targetDamage * effect.drain[0] / effect.drain[1]), 1);
                    this.heal(amount, source, target, 'drain');
                }
                if (this.gen > 4 && effect.drain && source) {
                    var amount = Math.round(targetDamage * effect.drain[0] / effect.drain[1]);
                    this.heal(amount, source, target, 'drain');
                }
            }
        }
        // @ts-ignore - FIXME AfterDamage passes an Effect, not an ActiveMove
        if (!effect.flags)
            effect.flags = {};
        if (instafaint) {
            for (var _c = 0, _d = targetArray.entries(); _c < _d.length; _c++) {
                var _e = _d[_c], i = _e[0], target = _e[1];
                if (!retVals[i] || !target)
                    continue;
                if (target.hp <= 0) {
                    this.debug('instafaint: ' + this.faintQueue.map(function (entry) { return entry.target.name; }));
                    this.faintMessages(true);
                    if (this.gen <= 2) {
                        target.faint();
                        if (this.gen <= 1)
                            this.queue = [];
                    }
                }
            }
        }
        retVals = this.runEvent('AfterDamage', (targetArray.filter(function (val) { return !!val; })), source, effect, retVals);
        return retVals;
    };
    Battle.prototype.damage = function (damage, target, source, effect, instafaint) {
        if (target === void 0) { target = null; }
        if (source === void 0) { source = null; }
        if (effect === void 0) { effect = null; }
        if (instafaint === void 0) { instafaint = false; }
        if (this.event) {
            if (!target)
                target = this.event.target;
            if (!source)
                source = this.event.source;
            if (!effect)
                effect = this.effect;
        }
        return this.spreadDamage([damage], [target], source, effect, instafaint)[0];
    };
    Battle.prototype.directDamage = function (damage, target, source, effect) {
        if (source === void 0) { source = null; }
        if (effect === void 0) { effect = null; }
        if (this.event) {
            if (!target)
                target = this.event.target;
            if (!source)
                source = this.event.source;
            if (!effect)
                effect = this.effect;
        }
        if (!target || !target.hp)
            return 0;
        if (!damage)
            return 0;
        damage = this.dex.clampIntRange(damage, 1);
        if (typeof effect === 'string' || !effect)
            effect = this.dex.getEffectByID((effect || ''));
        // In Gen 1 BUT NOT STADIUM, Substitute also takes confusion and HJK recoil damage
        if (this.gen <= 1 && this.dex.currentMod !== 'stadium' &&
            ['confusion', 'jumpkick', 'highjumpkick'].includes(effect.id) && target.volatiles['substitute']) {
            var hint = "In Gen 1, if a Pokemon with a Substitute hurts itself due to confusion or Jump Kick/Hi Jump Kick recoil and the target";
            if (source && source.volatiles['substitute']) {
                source.volatiles['substitute'].hp -= damage;
                if (source.volatiles['substitute'].hp <= 0) {
                    source.removeVolatile('substitute');
                    source.subFainted = true;
                }
                else {
                    this.add('-activate', source, 'Substitute', '[damage]');
                }
                this.hint(hint + " has a Substitute, the target's Substitute takes the damage.");
                return damage;
            }
            else {
                this.hint(hint + " does not have a Substitute there is no damage dealt.");
                return 0;
            }
        }
        damage = target.damage(damage, source, effect);
        switch (effect.id) {
            case 'strugglerecoil':
                this.add('-damage', target, target.getHealth, '[from] recoil');
                break;
            case 'confusion':
                this.add('-damage', target, target.getHealth, '[from] confusion');
                break;
            default:
                this.add('-damage', target, target.getHealth);
                break;
        }
        if (target.fainted)
            this.faint(target);
        return damage;
    };
    Battle.prototype.heal = function (damage, target, source, effect) {
        if (source === void 0) { source = null; }
        if (effect === void 0) { effect = null; }
        if (this.event) {
            if (!target)
                target = this.event.target;
            if (!source)
                source = this.event.source;
            if (!effect)
                effect = this.effect;
        }
        if (effect === 'drain')
            effect = this.dex.getEffectByID(effect);
        if (damage && damage <= 1)
            damage = 1;
        damage = this.trunc(damage);
        // for things like Liquid Ooze, the Heal event still happens when nothing is healed.
        damage = this.runEvent('TryHeal', target, source, effect, damage);
        if (!damage)
            return damage;
        if (!target || !target.hp)
            return false;
        if (!target.isActive)
            return false;
        if (target.hp >= target.maxhp)
            return false;
        var finalDamage = target.heal(damage, source, effect);
        switch (effect && effect.id) {
            case 'leechseed':
            case 'rest':
                this.add('-heal', target, target.getHealth, '[silent]');
                break;
            case 'drain':
                this.add('-heal', target, target.getHealth, '[from] drain', '[of] ' + source);
                break;
            case 'wish':
                break;
            case 'zpower':
                this.add('-heal', target, target.getHealth, '[zeffect]');
                break;
            default:
                if (!effect)
                    break;
                if (effect.effectType === 'Move') {
                    this.add('-heal', target, target.getHealth);
                }
                else if (source && source !== target) {
                    this.add('-heal', target, target.getHealth, '[from] ' + effect.fullname, '[of] ' + source);
                }
                else {
                    this.add('-heal', target, target.getHealth, '[from] ' + effect.fullname);
                }
                break;
        }
        this.runEvent('Heal', target, source, effect, finalDamage);
        return finalDamage;
    };
    Battle.prototype.chain = function (previousMod, nextMod) {
        // previousMod or nextMod can be either a number or an array [numerator, denominator]
        if (Array.isArray(previousMod)) {
            previousMod = this.trunc(previousMod[0] * 4096 / previousMod[1]);
        }
        else {
            previousMod = this.trunc(previousMod * 4096);
        }
        if (Array.isArray(nextMod)) {
            nextMod = this.trunc(nextMod[0] * 4096 / nextMod[1]);
        }
        else {
            nextMod = this.trunc(nextMod * 4096);
        }
        return ((previousMod * nextMod + 2048) >> 12) / 4096; // M'' = ((M * M') + 0x800) >> 12
    };
    Battle.prototype.chainModify = function (numerator, denominator) {
        var previousMod = this.trunc(this.event.modifier * 4096);
        if (Array.isArray(numerator)) {
            denominator = numerator[1];
            numerator = numerator[0];
        }
        var nextMod = 0;
        if (this.event.ceilModifier) {
            nextMod = Math.ceil(numerator * 4096 / (denominator || 1));
        }
        else {
            nextMod = this.trunc(numerator * 4096 / (denominator || 1));
        }
        this.event.modifier = ((previousMod * nextMod + 2048) >> 12) / 4096;
    };
    Battle.prototype.modify = function (value, numerator, denominator) {
        // You can also use:
        // modify(value, [numerator, denominator])
        // modify(value, fraction) - assuming you trust JavaScript's floating-point handler
        if (!denominator)
            denominator = 1;
        if (Array.isArray(numerator)) {
            denominator = numerator[1];
            numerator = numerator[0];
        }
        var tr = this.trunc;
        var modifier = tr(numerator * 4096 / denominator);
        return tr((tr(value * modifier) + 2048 - 1) / 4096);
    };
    Battle.prototype.getCategory = function (move) {
        return this.dex.getMove(move).category || 'Physical';
    };
    /**
     * 0 is a success dealing 0 damage, such as from False Swipe at 1 HP.
     *
     * Normal PS return value rules apply:
     * undefined = success, null = silent failure, false = loud failure
     */
    Battle.prototype.getDamage = function (pokemon, target, move, suppressMessages) {
        if (suppressMessages === void 0) { suppressMessages = false; }
        if (typeof move === 'string')
            move = this.dex.getActiveMove(move);
        if (typeof move === 'number') {
            var basePower_1 = move;
            move = new Data.Move({
                basePower: basePower_1,
                type: '???',
                category: 'Physical',
                willCrit: false
            });
            move.hit = 0;
        }
        if (!move.ignoreImmunity || (move.ignoreImmunity !== true && !move.ignoreImmunity[move.type])) {
            if (!target.runImmunity(move.type, !suppressMessages)) {
                return false;
            }
        }
        if (move.ohko)
            return target.maxhp;
        if (move.damageCallback)
            return move.damageCallback.call(this, pokemon, target);
        if (move.damage === 'level') {
            return pokemon.level;
        }
        else if (move.damage) {
            return move.damage;
        }
        var category = this.getCategory(move);
        var defensiveCategory = move.defensiveCategory || category;
        var basePower = move.basePower;
        if (move.basePowerCallback) {
            basePower = move.basePowerCallback.call(this, pokemon, target, move);
        }
        if (!basePower)
            return basePower === 0 ? undefined : basePower;
        basePower = this.dex.clampIntRange(basePower, 1);
        var critMult;
        var critRatio = this.runEvent('ModifyCritRatio', pokemon, target, move, move.critRatio || 0);
        if (this.gen <= 5) {
            critRatio = this.dex.clampIntRange(critRatio, 0, 5);
            critMult = [0, 16, 8, 4, 3, 2];
        }
        else {
            critRatio = this.dex.clampIntRange(critRatio, 0, 4);
            if (this.gen === 6) {
                critMult = [0, 16, 8, 2, 1];
            }
            else {
                critMult = [0, 24, 8, 2, 1];
            }
        }
        var moveHit = target.getMoveHitData(move);
        moveHit.crit = move.willCrit || false;
        if (move.willCrit === undefined) {
            if (critRatio) {
                moveHit.crit = this.randomChance(1, critMult[critRatio]);
            }
        }
        if (moveHit.crit) {
            moveHit.crit = this.runEvent('CriticalHit', target, null, move);
        }
        // happens after crit calculation
        basePower = this.runEvent('BasePower', pokemon, target, move, basePower, true);
        if (!basePower)
            return 0;
        basePower = this.dex.clampIntRange(basePower, 1);
        var level = pokemon.level;
        var attacker = pokemon;
        var defender = target;
        var attackStat = category === 'Physical' ? 'atk' : 'spa';
        var defenseStat = defensiveCategory === 'Physical' ? 'def' : 'spd';
        var statTable = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
        var attack;
        var defense;
        var atkBoosts = move.useTargetOffensive ? defender.boosts[attackStat] : attacker.boosts[attackStat];
        var defBoosts = move.useSourceDefensive ? attacker.boosts[defenseStat] : defender.boosts[defenseStat];
        var ignoreNegativeOffensive = !!move.ignoreNegativeOffensive;
        var ignorePositiveDefensive = !!move.ignorePositiveDefensive;
        if (moveHit.crit) {
            ignoreNegativeOffensive = true;
            ignorePositiveDefensive = true;
        }
        var ignoreOffensive = !!(move.ignoreOffensive || (ignoreNegativeOffensive && atkBoosts < 0));
        var ignoreDefensive = !!(move.ignoreDefensive || (ignorePositiveDefensive && defBoosts > 0));
        if (ignoreOffensive) {
            this.debug('Negating (sp)atk boost/penalty.');
            atkBoosts = 0;
        }
        if (ignoreDefensive) {
            this.debug('Negating (sp)def boost/penalty.');
            defBoosts = 0;
        }
        if (move.useTargetOffensive) {
            attack = defender.calculateStat(attackStat, atkBoosts);
        }
        else {
            attack = attacker.calculateStat(attackStat, atkBoosts);
        }
        if (move.useSourceDefensive) {
            defense = attacker.calculateStat(defenseStat, defBoosts);
        }
        else {
            defense = defender.calculateStat(defenseStat, defBoosts);
        }
        // Apply Stat Modifiers
        attack = this.runEvent('Modify' + statTable[attackStat], attacker, defender, move, attack);
        defense = this.runEvent('Modify' + statTable[defenseStat], defender, attacker, move, defense);
        var tr = this.trunc;
        // int(int(int(2 * L / 5 + 2) * A * P / D) / 50);
        var baseDamage = tr(tr(tr(tr(2 * level / 5 + 2) * basePower * attack) / defense) / 50);
        // Calculate damage modifiers separately (order differs between generations)
        return this.modifyDamage(baseDamage, pokemon, target, move, suppressMessages);
    };
    Battle.prototype.modifyDamage = function (baseDamage, pokemon, target, move, suppressMessages) {
        if (suppressMessages === void 0) { suppressMessages = false; }
        var tr = this.trunc;
        if (!move.type)
            move.type = '???';
        var type = move.type;
        baseDamage += 2;
        // multi-target modifier (doubles only)
        if (move.spreadHit) {
            var spreadModifier = move.spreadModifier || (this.gameType === 'free-for-all' ? 0.5 : 0.75);
            this.debug('Spread modifier: ' + spreadModifier);
            baseDamage = this.modify(baseDamage, spreadModifier);
        }
        // weather modifier
        baseDamage = this.runEvent('WeatherModifyDamage', pokemon, target, move, baseDamage);
        // crit - not a modifier
        var isCrit = target.getMoveHitData(move).crit;
        if (isCrit) {
            baseDamage = tr(baseDamage * (move.critModifier || (this.gen >= 6 ? 1.5 : 2)));
        }
        // random factor - also not a modifier
        baseDamage = this.randomizer(baseDamage);
        // STAB
        if (move.forceSTAB || (type !== '???' && pokemon.hasType(type))) {
            // The "???" type never gets STAB
            // Not even if you Roost in Gen 4 and somehow manage to use
            // Struggle in the same turn.
            // (On second thought, it might be easier to get a Missingno.)
            baseDamage = this.modify(baseDamage, move.stab || 1.5);
        }
        // types
        var typeMod = target.runEffectiveness(move);
        typeMod = this.dex.clampIntRange(typeMod, -6, 6);
        target.getMoveHitData(move).typeMod = typeMod;
        if (typeMod > 0) {
            if (!suppressMessages)
                this.add('-supereffective', target);
            for (var i = 0; i < typeMod; i++) {
                baseDamage *= 2;
            }
        }
        if (typeMod < 0) {
            if (!suppressMessages)
                this.add('-resisted', target);
            for (var i = 0; i > typeMod; i--) {
                baseDamage = tr(baseDamage / 2);
            }
        }
        if (isCrit && !suppressMessages)
            this.add('-crit', target);
        if (pokemon.status === 'brn' && move.category === 'Physical' && !pokemon.hasAbility('guts')) {
            if (this.gen < 6 || move.id !== 'facade') {
                baseDamage = this.modify(baseDamage, 0.5);
            }
        }
        // Generation 5, but nothing later, sets damage to 1 before the final damage modifiers
        if (this.gen === 5 && !baseDamage)
            baseDamage = 1;
        // Final modifier. Modifiers that modify damage after min damage check, such as Life Orb.
        baseDamage = this.runEvent('ModifyDamage', pokemon, target, move, baseDamage);
        if (move.isZPowered && target.getMoveHitData(move).zBrokeProtect) {
            baseDamage = this.modify(baseDamage, 0.25);
            this.add('-zbroken', target);
        }
        // Generation 6-7 moves the check for minimum 1 damage after the final modifier...
        if (this.gen !== 5 && !baseDamage)
            return 1;
        // ...but 16-bit truncation happens even later, and can truncate to 0
        return tr(baseDamage, 16);
    };
    Battle.prototype.randomizer = function (baseDamage) {
        var tr = this.trunc;
        return tr(tr(baseDamage * (100 - this.random(16))) / 100);
    };
    /**
     * Returns whether a proposed target for a move is valid.
     */
    Battle.prototype.validTargetLoc = function (targetLoc, source, targetType) {
        if (targetLoc === 0)
            return true;
        var numSlots = source.side.active.length;
        if (Math.abs(targetLoc) > numSlots)
            return false;
        var sourceLoc = -(source.position + 1);
        var isFoe = (targetLoc > 0);
        var acrossFromTargetLoc = -(numSlots + 1 - targetLoc);
        var isAdjacent = (isFoe ?
            Math.abs(acrossFromTargetLoc - sourceLoc) <= 1 :
            Math.abs(targetLoc - sourceLoc) === 1);
        var isSelf = (sourceLoc === targetLoc);
        switch (targetType) {
            case 'randomNormal':
            case 'scripted':
            case 'normal':
                return isAdjacent;
            case 'adjacentAlly':
                return isAdjacent && !isFoe;
            case 'adjacentAllyOrSelf':
                return isAdjacent && !isFoe || isSelf;
            case 'adjacentFoe':
                return isAdjacent && isFoe;
            case 'any':
                return !isSelf;
        }
        return false;
    };
    Battle.prototype.getTargetLoc = function (target, source) {
        var position = target.position + 1;
        return (target.side === source.side) ? -position : position;
    };
    Battle.prototype.validTarget = function (target, source, targetType) {
        return this.validTargetLoc(this.getTargetLoc(target, source), source, targetType);
    };
    Battle.prototype.getTarget = function (pokemon, move, targetLoc) {
        move = this.dex.getMove(move);
        var target;
        // Fails if the target is the user and the move can't target its own position
        if (['adjacentAlly', 'any', 'normal'].includes(move.target) && targetLoc === -(pokemon.position + 1) &&
            !pokemon.volatiles['twoturnmove'] && !pokemon.volatiles['iceball'] && !pokemon.volatiles['rollout']) {
            return move.isFutureMove ? pokemon : null;
        }
        if (move.target !== 'randomNormal' && this.validTargetLoc(targetLoc, pokemon, move.target)) {
            if (targetLoc > 0) {
                target = pokemon.side.foe.active[targetLoc - 1];
            }
            else {
                target = pokemon.side.active[-targetLoc - 1];
            }
            if (target && !(target.fainted && target.side !== pokemon.side)) {
                // Target is unfainted: no need to retarget
                // Or target is a fainted ally: attack shouldn't retarget
                return target;
            }
            // Chosen target not valid,
            // retarget randomly with resolveTarget
        }
        return this.resolveTarget(pokemon, move);
    };
    Battle.prototype.resolveTarget = function (pokemon, move) {
        // A move was used without a chosen target
        // For instance: Metronome chooses Ice Beam. Since the user didn't
        // choose a target when choosing Metronome, Ice Beam's target must
        // be chosen randomly.
        // The target is chosen randomly from possible targets, EXCEPT that
        // moves that can target either allies or foes will only target foes
        // when used without an explicit target.
        move = this.dex.getMove(move);
        if (move.target === 'adjacentAlly') {
            var allyActives = pokemon.side.active;
            var adjacentAllies = [allyActives[pokemon.position - 1], allyActives[pokemon.position + 1]];
            adjacentAllies = adjacentAllies.filter(function (active) { return active && !active.fainted; });
            return adjacentAllies.length ? this.sample(adjacentAllies) : null;
        }
        if (move.target === 'self' || move.target === 'all' || move.target === 'allySide' ||
            move.target === 'allyTeam' || move.target === 'adjacentAllyOrSelf') {
            return pokemon;
        }
        if (pokemon.side.active.length > 2) {
            if (move.target === 'adjacentFoe' || move.target === 'normal' || move.target === 'randomNormal') {
                // even if a move can target an ally, auto-resolution will never make it target an ally
                // i.e. if both your opponents faint before you use Flamethrower, it will fail instead of targeting your all
                var foeActives = pokemon.side.foe.active;
                var frontPosition = foeActives.length - 1 - pokemon.position;
                var adjacentFoes = foeActives.slice(frontPosition < 1 ? 0 : frontPosition - 1, frontPosition + 2);
                adjacentFoes = adjacentFoes.filter(function (active) { return active && !active.fainted; });
                if (adjacentFoes.length)
                    return this.sample(adjacentFoes);
                // no valid target at all, return a foe for any possible redirection
                return foeActives[frontPosition];
            }
        }
        return pokemon.side.foe.randomActive() || pokemon.side.foe.active[0];
    };
    Battle.prototype.checkFainted = function () {
        for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
            var side = _a[_i];
            for (var _b = 0, _c = side.active; _b < _c.length; _b++) {
                var pokemon = _c[_b];
                if (pokemon.fainted) {
                    pokemon.status = 'fnt';
                    pokemon.switchFlag = true;
                }
            }
        }
    };
    Battle.prototype.faintMessages = function (lastFirst) {
        if (lastFirst === void 0) { lastFirst = false; }
        if (this.ended)
            return;
        if (!this.faintQueue.length)
            return false;
        if (lastFirst) {
            this.faintQueue.unshift(this.faintQueue[this.faintQueue.length - 1]);
            this.faintQueue.pop();
        }
        var faintData;
        while (this.faintQueue.length) {
            faintData = this.faintQueue[0];
            this.faintQueue.shift();
            if (!faintData.target.fainted &&
                this.runEvent('BeforeFaint', faintData.target, faintData.source, faintData.effect)) {
                this.add('faint', faintData.target);
                faintData.target.side.pokemonLeft--;
                this.runEvent('Faint', faintData.target, faintData.source, faintData.effect);
                this.singleEvent('End', this.dex.getAbility(faintData.target.ability), faintData.target.abilityData, faintData.target);
                faintData.target.clearVolatile(false);
                faintData.target.fainted = true;
                faintData.target.isActive = false;
                faintData.target.isStarted = false;
                faintData.target.side.faintedThisTurn = true;
            }
        }
        if (this.gen <= 1) {
            // in gen 1, fainting skips the rest of the turn
            // residuals don't exist in gen 1
            this.queue = [];
        }
        else if (this.gen <= 3 && this.gameType === 'singles') {
            // in gen 3 or earlier, fainting in singles skips to residuals
            for (var _i = 0, _a = this.getAllActive(); _i < _a.length; _i++) {
                var pokemon = _a[_i];
                if (this.gen <= 2) {
                    // in gen 2, fainting skips moves only
                    this.cancelMove(pokemon);
                }
                else {
                    // in gen 3, fainting skips all moves and switches
                    this.cancelAction(pokemon);
                }
            }
        }
        var team1PokemonLeft = this.sides[0].pokemonLeft;
        var team2PokemonLeft = this.sides[1].pokemonLeft;
        var team3PokemonLeft = this.gameType === 'free-for-all' && this.sides[2].pokemonLeft;
        var team4PokemonLeft = this.gameType === 'free-for-all' && this.sides[3].pokemonLeft;
        if (this.gameType === 'multi') {
            team1PokemonLeft = this.sides.reduce(function (total, side) { return total + (side.n % 2 === 0 ? side.pokemonLeft : 0); }, 0);
            team2PokemonLeft = this.sides.reduce(function (total, side) { return total + (side.n % 2 === 1 ? side.pokemonLeft : 0); }, 0);
        }
        if (!team1PokemonLeft && !team2PokemonLeft && !team3PokemonLeft && !team4PokemonLeft) {
            this.win(faintData ? faintData.target.side : null);
            return true;
        }
        if (!team2PokemonLeft && !team3PokemonLeft && !team4PokemonLeft) {
            this.win(this.sides[0]);
            return true;
        }
        if (!team1PokemonLeft && !team3PokemonLeft && !team4PokemonLeft) {
            this.win(this.sides[1]);
            return true;
        }
        if (!team1PokemonLeft && !team2PokemonLeft && !team4PokemonLeft) {
            this.win(this.sides[2]);
            return true;
        }
        if (!team1PokemonLeft && !team2PokemonLeft && !team3PokemonLeft) {
            this.win(this.sides[3]);
            return true;
        }
        return false;
    };
    /**
     * Takes an object describing an action, and fills it out into a full
     * Action object.
     */
    Battle.prototype.resolveAction = function (action, midTurn) {
        if (midTurn === void 0) { midTurn = false; }
        if (!action)
            throw new Error("Action not passed to resolveAction");
        if (!action.side && action.pokemon)
            action.side = action.pokemon.side;
        if (!action.move && action.moveid)
            action.move = this.dex.getActiveMove(action.moveid);
        if (!action.choice && action.move)
            action.choice = 'move';
        if (!action.priority && action.priority !== 0) {
            var priorities = {
                beforeTurn: 100,
                beforeTurnMove: 99,
                "switch": 7,
                runUnnerve: 7.3,
                runSwitch: 7.2,
                runPrimal: 7.1,
                instaswitch: 101,
                megaEvo: 6.9,
                residual: -100,
                team: 102,
                start: 101
            };
            if (action.choice in priorities) {
                // @ts-ignore - Typescript being dumb about index signatures
                action.priority = priorities[action.choice];
            }
        }
        if (!midTurn) {
            if (action.choice === 'move') {
                if (!action.zmove && action.move.beforeTurnCallback) {
                    this.addToQueue({
                        choice: 'beforeTurnMove', pokemon: action.pokemon, move: action.move, targetLoc: action.targetLoc
                    });
                }
                if (action.mega) {
                    // TODO: Check that the Pokémon is not affected by Sky Drop.
                    // (This is currently being done in `runMegaEvo`).
                    this.addToQueue({
                        choice: 'megaEvo',
                        pokemon: action.pokemon
                    });
                }
            }
            else if (action.choice === 'switch' || action.choice === 'instaswitch') {
                if (typeof action.pokemon.switchFlag === 'string') {
                    action.sourceEffect = this.dex.getMove(action.pokemon.switchFlag);
                }
                action.pokemon.switchFlag = false;
                if (!action.speed)
                    action.speed = action.pokemon.getActionSpeed();
            }
        }
        var deferPriority = this.gen >= 7 && action.mega && action.mega !== 'done';
        if (action.move) {
            var target = null;
            action.move = this.dex.getActiveMove(action.move);
            if (!action.targetLoc) {
                target = this.resolveTarget(action.pokemon, action.move);
                // TODO: what actually happens here?
                if (target)
                    action.targetLoc = this.getTargetLoc(target, action.pokemon);
            }
            if (!action.priority && !deferPriority) {
                var move = action.move;
                if (action.zmove) {
                    var zMoveName = this.getZMove(action.move, action.pokemon, true);
                    if (zMoveName) {
                        var zMove = this.dex.getActiveMove(zMoveName);
                        if (zMove.exists && zMove.isZ) {
                            move = zMove;
                        }
                    }
                }
                var priority = this.runEvent('ModifyPriority', action.pokemon, target, move, move.priority);
                action.priority = priority;
                // In Gen 6, Quick Guard blocks moves with artificially enhanced priority.
                if (this.gen > 5)
                    action.move.priority = priority;
            }
        }
        if (!action.speed) {
            if ((action.choice === 'switch' || action.choice === 'instaswitch') && action.target) {
                action.speed = action.target.getActionSpeed();
            }
            else if (!action.pokemon) {
                action.speed = 1;
            }
            else if (!deferPriority) {
                action.speed = action.pokemon.getActionSpeed();
            }
        }
        return action;
    };
    /**
     * Adds the action last in the queue. Mostly used before sortQueue.
     */
    Battle.prototype.addToQueue = function (action) {
        if (Array.isArray(action)) {
            for (var _i = 0, action_1 = action; _i < action_1.length; _i++) {
                var curAction = action_1[_i];
                this.addToQueue(curAction);
            }
            return;
        }
        if (action.choice === 'pass')
            return;
        this.queue.push(this.resolveAction(action));
    };
    Battle.prototype.sortQueue = function () {
        this.speedSort(this.queue);
    };
    /**
     * Inserts the passed action into the action queue when it normally
     * would have happened (sorting by priority/speed), without
     * re-sorting the existing actions.
     */
    Battle.prototype.insertQueue = function (chosenAction, midTurn) {
        if (midTurn === void 0) { midTurn = false; }
        if (Array.isArray(chosenAction)) {
            for (var _i = 0, chosenAction_1 = chosenAction; _i < chosenAction_1.length; _i++) {
                var subAction = chosenAction_1[_i];
                this.insertQueue(subAction);
            }
            return;
        }
        if (chosenAction.pokemon)
            chosenAction.pokemon.updateSpeed();
        var action = this.resolveAction(chosenAction, midTurn);
        for (var _a = 0, _b = this.queue.entries(); _a < _b.length; _a++) {
            var _c = _b[_a], i = _c[0], curAction = _c[1];
            if (this.comparePriority(action, curAction) < 0) {
                this.queue.splice(i, 0, action);
                return;
            }
        }
        this.queue.push(action);
    };
    /**
     * Makes the passed action happen next (skipping speed order).
     */
    Battle.prototype.prioritizeAction = function (action, source, sourceEffect) {
        if (this.event && !sourceEffect)
            sourceEffect = this.effect;
        for (var _i = 0, _a = this.queue.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], curAction = _b[1];
            if (curAction === action) {
                this.queue.splice(i, 1);
                break;
            }
        }
        action.sourceEffect = sourceEffect;
        this.queue.unshift(action);
    };
    Battle.prototype.willAct = function () {
        for (var _i = 0, _a = this.queue; _i < _a.length; _i++) {
            var action = _a[_i];
            if (['move', 'switch', 'instaswitch', 'shift'].includes(action.choice)) {
                return action;
            }
        }
        return null;
    };
    Battle.prototype.willMove = function (pokemon) {
        if (pokemon.fainted)
            return false;
        for (var _i = 0, _a = this.queue; _i < _a.length; _i++) {
            var action = _a[_i];
            if (action.choice === 'move' && action.pokemon === pokemon) {
                return action;
            }
        }
        return null;
    };
    Battle.prototype.cancelAction = function (pokemon) {
        var length = this.queue.length;
        this.queue = this.queue.filter(function (action) {
            return !(action.pokemon === pokemon && action.priority >= -100);
        });
        return this.queue.length !== length;
    };
    Battle.prototype.cancelMove = function (pokemon) {
        for (var _i = 0, _a = this.queue.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], action = _b[1];
            if (action.choice === 'move' && action.pokemon === pokemon) {
                this.queue.splice(i, 1);
                return true;
            }
        }
        return false;
    };
    Battle.prototype.willSwitch = function (pokemon) {
        for (var _i = 0, _a = this.queue; _i < _a.length; _i++) {
            var action = _a[_i];
            if ((action.choice === 'switch' || action.choice === 'instaswitch') && action.pokemon === pokemon) {
                return action;
            }
        }
        return false;
    };
    Battle.prototype.runAction = function (action) {
        // returns whether or not we ended in a callback
        switch (action.choice) {
            case 'start': {
                // I GIVE UP, WILL WRESTLE WITH EVENT SYSTEM LATER
                var format = this.format;
                // Remove Pokémon duplicates remaining after `team` decisions.
                for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
                    var side = _a[_i];
                    side.pokemon = side.pokemon.slice(0, side.pokemonLeft);
                }
                if (format.teamLength && format.teamLength.battle) {
                    // Trim the team: not all of the Pokémon brought to Preview will battle.
                    for (var _b = 0, _c = this.sides; _b < _c.length; _b++) {
                        var side = _c[_b];
                        side.pokemon = side.pokemon.slice(0, format.teamLength.battle);
                        side.pokemonLeft = side.pokemon.length;
                    }
                }
                this.add('start');
                for (var _d = 0, _e = this.sides; _d < _e.length; _d++) {
                    var side = _e[_d];
                    for (var pos = 0; pos < side.active.length; pos++) {
                        this.switchIn(side.pokemon[pos], pos);
                    }
                }
                for (var _f = 0, _g = this.getAllPokemon(); _f < _g.length; _f++) {
                    var pokemon = _g[_f];
                    this.singleEvent('Start', this.dex.getEffectByID(pokemon.speciesid), pokemon.speciesData, pokemon);
                }
                this.midTurn = true;
                break;
            }
            case 'move':
                if (!action.pokemon.isActive)
                    return false;
                if (action.pokemon.fainted)
                    return false;
                this.runMove(action.move, action.pokemon, action.targetLoc, action.sourceEffect, action.zmove);
                break;
            case 'megaEvo':
                this.runMegaEvo(action.pokemon);
                break;
            case 'beforeTurnMove': {
                if (!action.pokemon.isActive)
                    return false;
                if (action.pokemon.fainted)
                    return false;
                this.debug('before turn callback: ' + action.move.id);
                var target = this.getTarget(action.pokemon, action.move, action.targetLoc);
                if (!target)
                    return false;
                if (!action.move.beforeTurnCallback)
                    throw new Error("beforeTurnMove has no beforeTurnCallback");
                action.move.beforeTurnCallback.call(this, action.pokemon, target);
                break;
            }
            case 'event':
                // @ts-ignore - easier than defining a custom event attribute TBH
                this.runEvent(action.event, action.pokemon);
                break;
            case 'team': {
                action.pokemon.side.pokemon.splice(action.index, 0, action.pokemon);
                action.pokemon.position = action.index;
                // we return here because the update event would crash since there are no active pokemon yet
                return;
            }
            case 'pass':
                return;
            case 'instaswitch':
            case 'switch':
                if (action.choice === 'switch' && action.pokemon.status && this.dex.data.Abilities.naturalcure) {
                    this.singleEvent('CheckShow', this.dex.getAbility('naturalcure'), null, action.pokemon);
                }
                if (action.pokemon.hp) {
                    action.pokemon.beingCalledBack = true;
                    var sourceEffect = action.sourceEffect;
                    if (sourceEffect && sourceEffect.selfSwitch === 'copyvolatile') {
                        action.pokemon.switchCopyFlag = true;
                    }
                    if (!action.pokemon.switchCopyFlag) {
                        this.runEvent('BeforeSwitchOut', action.pokemon);
                        if (this.gen >= 5) {
                            this.eachEvent('Update');
                        }
                    }
                    if (!this.runEvent('SwitchOut', action.pokemon)) {
                        // Warning: DO NOT interrupt a switch-out if you just want to trap a pokemon.
                        // To trap a pokemon and prevent it from switching out, (e.g. Mean Look, Magnet Pull)
                        // use the 'trapped' flag instead.
                        // Note: Nothing in BW or earlier interrupts a switch-out.
                        break;
                    }
                }
                action.pokemon.illusion = null;
                this.singleEvent('End', this.dex.getAbility(action.pokemon.ability), action.pokemon.abilityData, action.pokemon);
                if (!action.pokemon.hp && !action.pokemon.fainted) {
                    // a pokemon fainted from Pursuit before it could switch
                    if (this.gen <= 4) {
                        // in gen 2-4, the switch still happens
                        action.priority = -101;
                        this.queue.unshift(action);
                        this.hint("Previously chosen switches continue in Gen 2-4 after a Pursuit target faints.");
                        break;
                    }
                    // in gen 5+, the switch is cancelled
                    this.hint("A Pokemon can't switch between when it runs out of HP and when it faints");
                    break;
                }
                if (action.target.isActive) {
                    this.hint("A switch failed because the Pokémon trying to switch in is already in.");
                    break;
                }
                this.switchIn(action.target, action.pokemon.position, action.sourceEffect);
                break;
            case 'runUnnerve':
                this.singleEvent('PreStart', action.pokemon.getAbility(), action.pokemon.abilityData, action.pokemon);
                break;
            case 'runSwitch':
                this.runEvent('SwitchIn', action.pokemon);
                if (this.gen <= 2 && !action.pokemon.side.faintedThisTurn && action.pokemon.draggedIn !== this.turn) {
                    this.runEvent('AfterSwitchInSelf', action.pokemon);
                }
                if (!action.pokemon.hp)
                    break;
                action.pokemon.isStarted = true;
                if (!action.pokemon.fainted) {
                    this.singleEvent('Start', action.pokemon.getAbility(), action.pokemon.abilityData, action.pokemon);
                    action.pokemon.abilityOrder = this.abilityOrder++;
                    this.singleEvent('Start', action.pokemon.getItem(), action.pokemon.itemData, action.pokemon);
                }
                if (this.gen === 4) {
                    for (var _h = 0, _j = action.pokemon.side.foe.active; _h < _j.length; _h++) {
                        var foeActive = _j[_h];
                        foeActive.removeVolatile('substitutebroken');
                    }
                }
                action.pokemon.draggedIn = null;
                break;
            case 'runPrimal':
                if (!action.pokemon.transformed) {
                    this.singleEvent('Primal', action.pokemon.getItem(), action.pokemon.itemData, action.pokemon);
                }
                break;
            case 'shift': {
                if (!action.pokemon.isActive)
                    return false;
                if (action.pokemon.fainted)
                    return false;
                action.pokemon.activeTurns--;
                this.swapPosition(action.pokemon, 1);
                break;
            }
            case 'beforeTurn':
                this.eachEvent('BeforeTurn');
                break;
            case 'residual':
                this.add('');
                this.clearActiveMove(true);
                this.updateSpeed();
                this.residualEvent('Residual');
                this.add('upkeep');
                break;
        }
        // phazing (Roar, etc)
        for (var _k = 0, _l = this.sides; _k < _l.length; _k++) {
            var side = _l[_k];
            for (var _m = 0, _o = side.active; _m < _o.length; _m++) {
                var pokemon = _o[_m];
                if (pokemon.forceSwitchFlag) {
                    if (pokemon.hp)
                        this.dragIn(pokemon.side, pokemon.position);
                    pokemon.forceSwitchFlag = false;
                }
            }
        }
        this.clearActiveMove();
        // fainting
        this.faintMessages();
        if (this.ended)
            return true;
        // switching (fainted pokemon, U-turn, Baton Pass, etc)
        if (!this.queue.length || (this.gen <= 3 && ['move', 'residual'].includes(this.queue[0].choice))) {
            // in gen 3 or earlier, switching in fainted pokemon is done after
            // every move, rather than only at the end of the turn.
            this.checkFainted();
        }
        else if (action.choice === 'megaEvo' && this.gen >= 7) {
            this.eachEvent('Update');
            // In Gen 7, the action order is recalculated for a Pokémon that mega evolves.
            var moveIndex = this.queue.findIndex(function (queuedAction) {
                return queuedAction.pokemon === action.pokemon && queuedAction.choice === 'move';
            });
            if (moveIndex >= 0) {
                var moveAction = this.queue.splice(moveIndex, 1)[0];
                moveAction.mega = 'done';
                this.insertQueue(moveAction, true);
            }
            return false;
        }
        else if (this.queue.length && this.queue[0].choice === 'instaswitch') {
            return false;
        }
        var switches = this.sides.map(function (side) {
            return side.active.some(function (pokemon) { return pokemon && !!pokemon.switchFlag; });
        });
        for (var i = 0; i < this.sides.length; i++) {
            if (switches[i] && !this.canSwitch(this.sides[i])) {
                for (var _p = 0, _q = this.sides[i].active; _p < _q.length; _p++) {
                    var pokemon = _q[_p];
                    pokemon.switchFlag = false;
                }
                switches[i] = false;
            }
        }
        for (var _r = 0, switches_1 = switches; _r < switches_1.length; _r++) {
            var playerSwitch = switches_1[_r];
            if (playerSwitch) {
                if (this.gen >= 5) {
                    this.eachEvent('Update');
                }
                this.makeRequest('switch');
                return true;
            }
        }
        this.eachEvent('Update');
        return false;
    };
    Battle.prototype.go = function () {
        this.add('');
        if (this.requestState)
            this.requestState = '';
        if (!this.midTurn) {
            this.queue.push(this.resolveAction({ choice: 'residual' }));
            this.queue.unshift(this.resolveAction({ choice: 'beforeTurn' }));
            this.midTurn = true;
        }
        while (this.queue.length) {
            var action = this.queue[0];
            this.queue.shift();
            this.runAction(action);
            if (this.requestState || this.ended)
                return;
        }
        this.nextTurn();
        this.midTurn = false;
        this.queue = [];
    };
    /**
     * Changes a pokemon's action, and inserts its new action
     * in priority order.
     *
     * You'd normally want the OverrideAction event (which doesn't
     * change priority order).
     */
    Battle.prototype.changeAction = function (pokemon, action) {
        this.cancelAction(pokemon);
        if (!action.pokemon)
            action.pokemon = pokemon;
        this.insertQueue(action);
    };
    /**
     * Takes a choice string passed from the client. Starts the next
     * turn if all required choices have been made.
     */
    Battle.prototype.choose = function (sideid, input) {
        var side = this.getSide(sideid);
        if (!side.choose(input))
            return false;
        if (!side.isChoiceDone()) {
            side.emitChoiceError("Incomplete choice: " + input + " - missing other pokemon");
            return false;
        }
        if (this.allChoicesDone())
            this.commitDecisions();
        return true;
    };
    /**
     * Convenience method for easily making choices.
     */
    Battle.prototype.makeChoices = function () {
        var inputs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            inputs[_i] = arguments[_i];
        }
        if (inputs.length) {
            for (var _a = 0, _b = inputs.entries(); _a < _b.length; _a++) {
                var _c = _b[_a], i = _c[0], input = _c[1];
                if (input)
                    this.sides[i].choose(input);
            }
        }
        else {
            for (var _d = 0, _e = this.sides; _d < _e.length; _d++) {
                var side = _e[_d];
                side.autoChoose();
            }
        }
        this.commitDecisions();
    };
    Battle.prototype.commitDecisions = function () {
        var _a;
        this.updateSpeed();
        var oldQueue = this.queue;
        this.queue = [];
        if (!this.allChoicesDone())
            throw new Error("Not all choices done");
        for (var _i = 0, _b = this.sides; _i < _b.length; _i++) {
            var side = _b[_i];
            var choice = side.getChoice();
            if (choice)
                this.inputLog.push(">" + side.id + " " + choice);
        }
        for (var _c = 0, _d = this.sides; _c < _d.length; _c++) {
            var side = _d[_c];
            this.addToQueue(side.choice.actions);
        }
        this.sortQueue();
        (_a = this.queue).push.apply(_a, oldQueue);
        this.requestState = '';
        for (var _e = 0, _f = this.sides; _e < _f.length; _e++) {
            var side = _f[_e];
            side.activeRequest = null;
        }
        this.go();
    };
    Battle.prototype.undoChoice = function (sideid) {
        var side = this.getSide(sideid);
        if (!side.requestState)
            return;
        if (side.choice.cantUndo) {
            side.emitChoiceError("Can't undo: A trapping/disabling effect would cause undo to leak information");
            return;
        }
        side.clearChoice();
    };
    /**
     * returns true if both decisions are complete
     */
    Battle.prototype.allChoicesDone = function () {
        var totalActions = 0;
        for (var _i = 0, _a = this.sides; _i < _a.length; _i++) {
            var side = _a[_i];
            if (side.isChoiceDone()) {
                if (!this.supportCancel)
                    side.choice.cantUndo = true;
                totalActions++;
            }
        }
        return totalActions >= this.sides.length;
    };
    Battle.prototype.hint = function (hint, once, side) {
        if (this.hints.has(hint))
            return;
        if (side) {
            this.addSplit(side.id, ['-hint', hint]);
        }
        else {
            this.add('-hint', hint);
        }
        if (once)
            this.hints.add(hint);
    };
    Battle.prototype.addSplit = function (side, secret, shared) {
        this.log.push("|split|" + side);
        this.add.apply(this, secret);
        if (shared) {
            this.add.apply(this, shared);
        }
        else {
            this.log.push('');
        }
    };
    Battle.prototype.add = function () {
        var parts = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            parts[_i] = arguments[_i];
        }
        if (!parts.some(function (part) { return typeof part === 'function'; })) {
            this.log.push("|" + parts.join('|'));
            return;
        }
        var side = null;
        var secret = [];
        var shared = [];
        for (var _a = 0, parts_1 = parts; _a < parts_1.length; _a++) {
            var part = parts_1[_a];
            if (typeof part === 'function') {
                var split = part();
                if (side && side !== split.side)
                    throw new Error("Multiple sides passed to add");
                side = split.side;
                secret.push(split.secret);
                shared.push(split.shared);
            }
            else {
                secret.push(part);
                shared.push(part);
            }
        }
        this.addSplit(side, secret, shared);
    };
    // tslint:disable-next-line:ban-types
    Battle.prototype.addMove = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.lastMoveLine = this.log.length;
        this.log.push("|" + args.join('|'));
    };
    // tslint:disable-next-line:ban-types
    Battle.prototype.attrLastMove = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.lastMoveLine < 0)
            return;
        if (this.log[this.lastMoveLine].startsWith('|-anim|')) {
            if (args.includes('[still]')) {
                this.log.splice(this.lastMoveLine, 1);
                this.lastMoveLine = -1;
                return;
            }
        }
        else if (args.includes('[still]')) {
            // If no animation plays, the target should never be known
            var parts = this.log[this.lastMoveLine].split('|');
            parts[4] = '';
            this.log[this.lastMoveLine] = parts.join('|');
        }
        this.log[this.lastMoveLine] += "|" + args.join('|');
    };
    Battle.prototype.retargetLastMove = function (newTarget) {
        if (this.lastMoveLine < 0)
            return;
        var parts = this.log[this.lastMoveLine].split('|');
        parts[4] = newTarget.toString();
        this.log[this.lastMoveLine] = parts.join('|');
    };
    Battle.prototype.debug = function (activity) {
        if (this.debugMode) {
            this.add('debug', activity);
        }
    };
    Battle.extractUpdateForSide = function (data, side) {
        if (side === void 0) { side = 'spectator'; }
        if (side === 'omniscient') {
            // Grab all secret data
            return data.replace(/\n\|split\|p[1234]\n([^\n]*)\n(?:[^\n]*)/g, '\n$1');
        }
        // Grab secret data side has access to
        switch (side) {
            case 'p1':
                data = data.replace(/\n\|split\|p1\n([^\n]*)\n(?:[^\n]*)/g, '\n$1');
                break;
            case 'p2':
                data = data.replace(/\n\|split\|p2\n([^\n]*)\n(?:[^\n]*)/g, '\n$1');
                break;
            case 'p3':
                data = data.replace(/\n\|split\|p3\n([^\n]*)\n(?:[^\n]*)/g, '\n$1');
                break;
            case 'p4':
                data = data.replace(/\n\|split\|p4\n([^\n]*)\n(?:[^\n]*)/g, '\n$1');
                break;
        }
        // Discard remaining secret data
        // Note: the last \n? is for secret data that are empty when shared
        return data.replace(/\n\|split\|(?:[^\n]*)\n(?:[^\n]*)\n\n?/g, '\n');
    };
    Battle.prototype.getDebugLog = function () {
        return Battle.extractUpdateForSide(this.log.join('\n'), 'omniscient');
    };
    Battle.prototype.debugError = function (activity) {
        this.add('debug', activity);
    };
    // players
    Battle.prototype.getTeam = function (options) {
        var team = options.team;
        if (typeof team === 'string')
            team = dex_1.Dex.fastUnpackTeam(team);
        if ((!this.format.team || this.deserialized) && team)
            return team;
        if (!options.seed) {
            options.seed = prng_1.PRNG.generateSeed();
        }
        if (!this.teamGenerator) {
            this.teamGenerator = this.dex.getTeamGenerator(this.format, options.seed);
        }
        else {
            this.teamGenerator.setSeed(options.seed);
        }
        team = this.teamGenerator.getTeam(options);
        return team;
    };
    Battle.prototype.setPlayer = function (slot, options) {
        var side;
        var didSomething = true;
        var slotNum = parseInt(slot[1], 10) - 1;
        if (!this.sides[slotNum]) {
            // create player
            var team = this.getTeam(options);
            side = new side_1.Side(options.name || "Player " + (slotNum + 1), this, slotNum, team);
            if (options.avatar)
                side.avatar = '' + options.avatar;
            this.sides[slotNum] = side;
        }
        else {
            // edit player
            side = this.sides[slotNum];
            didSomething = false;
            if (options.name && side.name !== options.name) {
                side.name = options.name;
                didSomething = true;
            }
            if (options.avatar && side.avatar !== '' + options.avatar) {
                side.avatar = '' + options.avatar;
                didSomething = true;
            }
            if (options.team)
                throw new Error("Player " + slot + " already has a team!");
        }
        if (options.team && typeof options.team !== 'string') {
            options.team = this.dex.packTeam(options.team);
        }
        if (!didSomething)
            return;
        this.inputLog.push(">player " + slot + " " + JSON.stringify(options));
        this.add('player', side.id, side.name, side.avatar, options.rating || '');
        this.start();
    };
    /** @deprecated */
    Battle.prototype.join = function (slot, name, avatar, team) {
        this.setPlayer(slot, { name: name, avatar: avatar, team: team });
        return this.getSide(slot);
    };
    Battle.prototype.sendUpdates = function () {
        if (this.sentLogPos >= this.log.length)
            return;
        this.send('update', this.log.slice(this.sentLogPos));
        this.sentLogPos = this.log.length;
        if (!this.sentEnd && this.ended) {
            var log = {
                winner: this.winner,
                seed: this.prngSeed,
                turns: this.turn,
                p1: this.sides[0].name,
                p2: this.sides[1].name,
                p3: this.sides[2] && this.sides[2].name,
                p4: this.sides[3] && this.sides[3].name,
                p1team: this.sides[0].team,
                p2team: this.sides[1].team,
                p3team: this.sides[2] && this.sides[2].team,
                p4team: this.sides[3] && this.sides[3].team,
                score: [this.sides[0].pokemonLeft, this.sides[1].pokemonLeft],
                inputLog: this.inputLog
            };
            if (this.sides[2]) {
                log.score.push(this.sides[2].pokemonLeft);
            }
            else {
                delete log.p3;
                delete log.p3team;
            }
            if (this.sides[3]) {
                log.score.push(this.sides[3].pokemonLeft);
            }
            else {
                delete log.p4;
                delete log.p4team;
            }
            this.send('end', JSON.stringify(log));
            this.sentEnd = true;
        }
    };
    Battle.prototype.combineResults = function (left, right) {
        var NOT_FAILURE = 'string';
        var NULL = 'object';
        var resultsPriorities = ['undefined', NOT_FAILURE, NULL, 'boolean', 'number'];
        if (resultsPriorities.indexOf(typeof left) > resultsPriorities.indexOf(typeof right)) {
            return left;
        }
        else if (left && !right && right !== 0) {
            return left;
        }
        else if (typeof left === 'number' && typeof right === 'number') {
            return (left + right);
        }
        else {
            return right;
        }
    };
    Battle.prototype.getSide = function (sideid) {
        return this.sides[parseInt(sideid[1], 10) - 1];
    };
    Battle.prototype.afterMoveSecondaryEvent = function (targets, pokemon, move) {
        throw new UnimplementedError('afterMoveSecondary');
    };
    Battle.prototype.calcRecoilDamage = function (damageDealt, move) {
        throw new UnimplementedError('calcRecoilDamage');
    };
    Battle.prototype.canMegaEvo = function (pokemon) {
        throw new UnimplementedError('canMegaEvo');
    };
    Battle.prototype.canUltraBurst = function (pokemon) {
        throw new UnimplementedError('canUltraBurst');
    };
    Battle.prototype.canZMove = function (pokemon) {
        throw new UnimplementedError('canZMove');
    };
    Battle.prototype.forceSwitch = function (damage, targets, source, move, moveData, isSecondary, isSelf) {
        throw new UnimplementedError('forceSwitch');
    };
    Battle.prototype.getActiveZMove = function (move, pokemon) {
        throw new UnimplementedError('getActiveZMove');
    };
    Battle.prototype.getSpreadDamage = function (damage, targets, source, move, moveData, isSecondary, isSelf) {
        throw new UnimplementedError('getSpreadDamage');
    };
    Battle.prototype.getZMove = function (move, pokemon, skipChecks) {
        throw new UnimplementedError('getZMove');
    };
    Battle.prototype.hitStepAccuracy = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepAccuracy');
    };
    Battle.prototype.hitStepBreakProtect = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepBreakProtect');
    };
    Battle.prototype.hitStepMoveHitLoop = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepMoveHitLoop');
    };
    Battle.prototype.hitStepPowderImmunity = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepPowderImmunity');
    };
    Battle.prototype.hitStepPranksterImmunity = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepPranksterImmunity');
    };
    Battle.prototype.hitStepStealBoosts = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepStealBoosts');
    };
    Battle.prototype.hitStepTryHitEvent = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepTryHitEvent');
    };
    Battle.prototype.hitStepInvulnerabilityEvent = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepInvulnerabilityEvent ');
    };
    Battle.prototype.hitStepTypeImmunity = function (targets, pokemon, move) {
        throw new UnimplementedError('hitStepTypeImmunity');
    };
    Battle.prototype.isAdjacent = function (pokemon1, pokemon2) {
        throw new UnimplementedError('isAdjacent');
    };
    Battle.prototype.moveHit = function (target, pokemon, move, moveData, isSecondary, isSelf) {
        throw new UnimplementedError('moveHit');
    };
    /**
     * This function is also used for Ultra Bursting.
     * Takes the Pokemon that will Mega Evolve or Ultra Burst as a parameter.
     * Returns false if the Pokemon cannot Mega Evolve or Ultra Burst, otherwise returns true.
     */
    Battle.prototype.runMegaEvo = function (pokemon) {
        throw new UnimplementedError('runMegaEvo');
    };
    Battle.prototype.runMove = function (moveOrMoveName, pokemon, targetLoc, sourceEffect, zMove, externalMove) {
        throw new UnimplementedError('runMove');
    };
    Battle.prototype.runMoveEffects = function (damage, targets, source, move, moveData, isSecondary, isSelf) {
        throw new UnimplementedError('runMoveEffects');
    };
    Battle.prototype.runZPower = function (move, pokemon) {
        throw new UnimplementedError('runZPower');
    };
    Battle.prototype.secondaries = function (targets, source, move, moveData, isSelf) {
        throw new UnimplementedError('secondaries');
    };
    Battle.prototype.selfDrops = function (targets, source, move, moveData, isSecondary) {
        throw new UnimplementedError('selfDrops');
    };
    Battle.prototype.spreadMoveHit = function (targets, pokemon, move, moveData, isSecondary, isSelf) {
        throw new UnimplementedError('spreadMoveHit');
    };
    Battle.prototype.targetTypeChoices = function (targetType) {
        throw new UnimplementedError('targetTypeChoices');
    };
    Battle.prototype.tryMoveHit = function (target, pokemon, move) {
        throw new UnimplementedError('tryMoveHit');
    };
    Battle.prototype.tryPrimaryHitEvent = function (damage, targets, pokemon, move, moveData, isSecondary) {
        throw new UnimplementedError('tryPrimaryHitEvent');
    };
    Battle.prototype.trySpreadMoveHit = function (targets, pokemon, move) {
        throw new UnimplementedError('trySpreadMoveHit');
    };
    Battle.prototype.useMove = function (move, pokemon, target, sourceEffect, zMove) {
        throw new UnimplementedError('useMove');
    };
    /**
     * target = undefined: automatically resolve target
     * target = null: no target (move will fail)
     */
    Battle.prototype.useMoveInner = function (move, pokemon, target, sourceEffect, zMove) {
        throw new UnimplementedError('useMoveInner');
    };
    Battle.prototype.destroy = function () {
        // deallocate ourself
        // deallocate children and get rid of references to them
        this.field.destroy();
        // @ts-ignore - readonly
        this.field = null;
        for (var i = 0; i < this.sides.length; i++) {
            if (this.sides[i]) {
                this.sides[i].destroy();
                this.sides[i] = null;
            }
        }
        for (var _i = 0, _a = this.queue; _i < _a.length; _i++) {
            var action = _a[_i];
            delete action.pokemon;
        }
        this.queue = [];
        // in case the garbage collector really sucks, at least deallocate the log
        // @ts-ignore - readonly
        this.log = [];
    };
    return Battle;
}());
exports.Battle = Battle;
var UnimplementedError = /** @class */ (function (_super) {
    __extends(UnimplementedError, _super);
    function UnimplementedError(name) {
        var _this = _super.call(this, "The " + name + " function needs to be implemented in scripts.js or the battle format.") || this;
        _this.name = 'UnimplementedError';
        return _this;
    }
    return UnimplementedError;
}(Error));
