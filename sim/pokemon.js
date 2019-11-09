"use strict";
/**
 * Simulator Pokemon
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT license
 */
exports.__esModule = true;
var state_1 = require("./state");
var Pokemon = /** @class */ (function () {
    function Pokemon(set, side) {
        var _this = this;
        this.getDetails = function () {
            var health = _this.getHealth();
            var details = _this.details;
            if (_this.illusion) {
                var illusionDetails = _this.illusion.template.species + (_this.level === 100 ? '' : ', L' + _this.level) +
                    (_this.illusion.gender === '' ? '' : ', ' + _this.illusion.gender) + (_this.illusion.set.shiny ? ', shiny' : '');
                details = illusionDetails;
            }
            return { side: health.side, secret: details + "|" + health.secret, shared: details + "|" + health.shared };
        };
        this.getHealth = function () {
            if (!_this.hp)
                return { side: _this.side.id, secret: '0 fnt', shared: '0 fnt' };
            var secret = _this.hp + "/" + _this.maxhp;
            var shared;
            var ratio = _this.hp / _this.maxhp;
            if (_this.battle.reportExactHP) {
                shared = secret;
            }
            else if (_this.battle.reportPercentages) {
                // HP Percentage Mod mechanics
                var percentage = Math.ceil(ratio * 100);
                if ((percentage === 100) && (ratio < 1.0)) {
                    percentage = 99;
                }
                shared = percentage + "/100";
            }
            else {
                // In-game accurate pixel health mechanics
                var pixels = Math.floor(ratio * 48) || 1;
                shared = pixels + "/48";
                if ((pixels === 9) && (ratio > 0.2)) {
                    shared += 'y'; // force yellow HP bar
                }
                else if ((pixels === 24) && (ratio > 0.5)) {
                    shared += 'g'; // force green HP bar
                }
            }
            if (_this.status) {
                secret += " " + _this.status;
                shared += " " + _this.status;
            }
            return { side: _this.side.id, secret: secret, shared: shared };
        };
        this.side = side;
        this.battle = side.battle;
        var pokemonScripts = this.battle.dex.data.Scripts.pokemon;
        if (pokemonScripts)
            Object.assign(this, pokemonScripts);
        if (typeof set === 'string')
            set = { name: set };
        this.set = set;
        this.baseTemplate = this.battle.dex.getTemplate(set.species || set.name);
        if (!this.baseTemplate.exists) {
            throw new Error("Unidentified species: " + this.baseTemplate.name);
        }
        this.template = this.baseTemplate;
        this.species = this.battle.dex.getSpecies(set.species);
        this.speciesid = toID(this.species);
        if (set.name === set.species || !set.name) {
            set.name = this.baseTemplate.baseSpecies;
        }
        this.speciesData = { id: this.speciesid };
        this.name = set.name.substr(0, 20);
        this.fullname = this.side.id + ': ' + this.name;
        this.id = this.fullname;
        set.level = this.battle.dex.clampIntRange(set.forcedLevel || set.level || 100, 1, 9999);
        this.level = set.level;
        var genders = { M: 'M', F: 'F', N: 'N' };
        this.gender = genders[set.gender] || this.template.gender || (this.battle.random() * 2 < 1 ? 'M' : 'F');
        if (this.gender === 'N')
            this.gender = '';
        this.happiness = typeof set.happiness === 'number' ? this.battle.dex.clampIntRange(set.happiness, 0, 255) : 255;
        this.pokeball = this.set.pokeball || 'pokeball';
        this.baseMoveSlots = [];
        this.moveSlots = [];
        if (this.set.moves) {
            for (var _i = 0, _a = this.set.moves; _i < _a.length; _i++) {
                var moveid = _a[_i];
                var move = this.battle.dex.getMove(moveid);
                if (!move.id)
                    continue;
                if (move.id === 'hiddenpower' && move.type !== 'Normal') {
                    if (!set.hpType)
                        set.hpType = move.type;
                    move = this.battle.dex.getMove('hiddenpower');
                }
                this.baseMoveSlots.push({
                    move: move.name,
                    id: move.id,
                    pp: ((move.noPPBoosts || move.isZ) ? move.pp : move.pp * 8 / 5),
                    maxpp: ((move.noPPBoosts || move.isZ) ? move.pp : move.pp * 8 / 5),
                    target: move.target,
                    disabled: false,
                    disabledSource: '',
                    used: false
                });
            }
        }
        this.position = 0;
        this.details = this.species + (this.level === 100 ? '' : ', L' + this.level) +
            (this.gender === '' ? '' : ', ' + this.gender) + (this.set.shiny ? ', shiny' : '');
        this.status = '';
        this.statusData = {};
        this.volatiles = {};
        this.showCure = false;
        if (!this.set.evs) {
            this.set.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        }
        if (!this.set.ivs) {
            this.set.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
        }
        var stats = { hp: 31, atk: 31, def: 31, spe: 31, spa: 31, spd: 31 };
        var stat;
        for (stat in stats) {
            if (!this.set.evs[stat])
                this.set.evs[stat] = 0;
            if (!this.set.ivs[stat] && this.set.ivs[stat] !== 0)
                this.set.ivs[stat] = 31;
        }
        for (stat in this.set.evs) {
            this.set.evs[stat] = this.battle.dex.clampIntRange(this.set.evs[stat], 0, 255);
        }
        for (stat in this.set.ivs) {
            this.set.ivs[stat] = this.battle.dex.clampIntRange(this.set.ivs[stat], 0, 31);
        }
        if (this.battle.gen && this.battle.gen <= 2) {
            // We represent DVs using even IVs. Ensure they are in fact even.
            for (stat in this.set.ivs) {
                this.set.ivs[stat] &= 30;
            }
        }
        var hpData = this.battle.dex.getHiddenPower(this.set.ivs);
        this.hpType = set.hpType || hpData.type;
        this.hpPower = hpData.power;
        this.baseHpType = this.hpType;
        this.baseHpPower = this.hpPower;
        // initialized in this.setTemplate(this.baseTemplate)
        this.baseStoredStats = null;
        this.storedStats = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        this.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
        this.baseAbility = toID(set.ability);
        this.ability = this.baseAbility;
        this.abilityData = { id: this.ability };
        this.item = toID(set.item);
        this.itemData = { id: this.item };
        this.lastItem = '';
        this.usedItemThisTurn = false;
        this.ateBerry = false;
        this.trapped = false;
        this.maybeTrapped = false;
        this.maybeDisabled = false;
        this.illusion = null;
        this.transformed = false;
        this.fainted = false;
        this.faintQueued = false;
        this.subFainted = null;
        this.types = this.baseTemplate.types;
        this.addedType = '';
        this.knownType = true;
        this.apparentType = this.baseTemplate.types.join('/');
        this.switchFlag = false;
        this.forceSwitchFlag = false;
        this.switchCopyFlag = false;
        this.draggedIn = null;
        this.newlySwitched = false;
        this.beingCalledBack = false;
        this.lastMove = null;
        this.moveThisTurn = '';
        this.hurtThisTurn = false;
        this.lastDamage = 0;
        this.attackedBy = [];
        this.isActive = false;
        this.activeTurns = 0;
        this.truantTurn = false;
        this.isStarted = false;
        this.duringMove = false;
        this.weighthg = 1;
        this.speed = 0;
        this.abilityOrder = 0;
        this.canMegaEvo = this.battle.canMegaEvo(this);
        this.canUltraBurst = this.battle.canUltraBurst(this);
        // This is used in gen 1 only, here to avoid code repetition.
        // Only declared if gen 1 to avoid declaring an object we aren't going to need.
        if (this.battle.gen === 1)
            this.modifiedStats = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        this.clearVolatile();
        this.maxhp = this.template.maxHP || this.baseStoredStats.hp;
        this.hp = this.maxhp;
        /**
         * An object for storing untyped data, for mods to use.
         */
        this.m = {};
    }
    Pokemon.prototype.toJSON = function () {
        return state_1.State.serializePokemon(this);
    };
    Object.defineProperty(Pokemon.prototype, "moves", {
        get: function () {
            return this.moveSlots.map(function (moveSlot) { return moveSlot.id; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Pokemon.prototype, "baseMoves", {
        get: function () {
            return this.baseMoveSlots.map(function (moveSlot) { return moveSlot.id; });
        },
        enumerable: true,
        configurable: true
    });
    Pokemon.prototype.getSlot = function () {
        var positionOffset = Math.floor(this.side.n / 2) * this.side.active.length;
        var positionLetter = 'abcdef'.charAt(this.position + positionOffset);
        return this.side.id + positionLetter;
    };
    Pokemon.prototype.toString = function () {
        var fullname = (this.illusion) ? this.illusion.fullname : this.fullname;
        return this.isActive ? this.getSlot() + fullname.slice(2) : fullname;
    };
    Pokemon.prototype.updateSpeed = function () {
        this.speed = this.getActionSpeed();
    };
    Pokemon.prototype.calculateStat = function (statName, boost, modifier) {
        statName = toID(statName);
        // @ts-ignore - type checking prevents 'hp' from being passed, but we're paranoid
        if (statName === 'hp')
            throw new Error("Please read `maxhp` directly");
        // base stat
        var stat = this.storedStats[statName];
        // Wonder Room swaps defenses before calculating anything else
        if ('wonderroom' in this.battle.field.pseudoWeather) {
            if (statName === 'def') {
                stat = this.storedStats['spd'];
            }
            else if (statName === 'spd') {
                stat = this.storedStats['def'];
            }
        }
        // stat boosts
        var boosts = {};
        var boostName = statName;
        boosts[boostName] = boost;
        boosts = this.battle.runEvent('ModifyBoost', this, null, null, boosts);
        boost = boosts[boostName];
        var boostTable = [1, 1.5, 2, 2.5, 3, 3.5, 4];
        if (boost > 6)
            boost = 6;
        if (boost < -6)
            boost = -6;
        if (boost >= 0) {
            stat = Math.floor(stat * boostTable[boost]);
        }
        else {
            stat = Math.floor(stat / boostTable[-boost]);
        }
        // stat modifier
        return this.battle.modify(stat, (modifier || 1));
    };
    Pokemon.prototype.getStat = function (statName, unboosted, unmodified) {
        statName = toID(statName);
        // @ts-ignore - type checking prevents 'hp' from being passed, but we're paranoid
        if (statName === 'hp')
            throw new Error("Please read `maxhp` directly");
        // base stat
        var stat = this.storedStats[statName];
        // Download ignores Wonder Room's effect, but this results in
        // stat stages being calculated on the opposite defensive stat
        if (unmodified && 'wonderroom' in this.battle.field.pseudoWeather) {
            if (statName === 'def') {
                statName = 'spd';
            }
            else if (statName === 'spd') {
                statName = 'def';
            }
        }
        // stat boosts
        if (!unboosted) {
            var boosts = this.battle.runEvent('ModifyBoost', this, null, null, Object.assign({}, this.boosts));
            var boost = boosts[statName];
            var boostTable = [1, 1.5, 2, 2.5, 3, 3.5, 4];
            if (boost > 6)
                boost = 6;
            if (boost < -6)
                boost = -6;
            if (boost >= 0) {
                stat = Math.floor(stat * boostTable[boost]);
            }
            else {
                stat = Math.floor(stat / boostTable[-boost]);
            }
        }
        // stat modifier effects
        if (!unmodified) {
            var statTable = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
            stat = this.battle.runEvent('Modify' + statTable[statName], this, null, null, stat);
        }
        if (statName === 'spe' && stat > 10000)
            stat = 10000;
        return stat;
    };
    Pokemon.prototype.getActionSpeed = function () {
        var speed = this.getStat('spe', false, false);
        if (this.battle.field.getPseudoWeather('trickroom')) {
            speed = 0x2710 - speed;
        }
        return this.battle.trunc(speed, 13);
    };
    /* Commented out for now until a use for Combat Power is found in Let's Go
    getCombatPower() {
        let statSum = 0;
        let awakeningSum = 0;
        for (const stat in this.stats) {
            statSum += this.calculateStat(stat, this.boosts[stat as BoostName]);
            awakeningSum += this.calculateStat(
                stat, this.boosts[stat as BoostName]) + this.battle.getAwakeningValues(this.set, stat);
        }
        const combatPower = Math.floor(Math.floor(statSum * this.level * 6 / 100) +
            (Math.floor(awakeningSum) * Math.floor((this.level * 4) / 100 + 2)));
        return this.battle.dex.clampIntRange(combatPower, 0, 10000);
    }
    */
    Pokemon.prototype.getWeight = function () {
        var weighthg = this.battle.runEvent('ModifyWeight', this, null, null, this.weighthg);
        return Math.max(1, weighthg);
    };
    Pokemon.prototype.getMoveData = function (move) {
        move = this.battle.dex.getMove(move);
        for (var _i = 0, _a = this.moveSlots; _i < _a.length; _i++) {
            var moveSlot = _a[_i];
            if (moveSlot.id === move.id) {
                return moveSlot;
            }
        }
        return null;
    };
    Pokemon.prototype.getMoveHitData = function (move) {
        if (!move.moveHitData)
            move.moveHitData = {};
        var slot = this.getSlot();
        return move.moveHitData[slot] || (move.moveHitData[slot] = {
            crit: false,
            typeMod: 0,
            zBrokeProtect: false
        });
    };
    Pokemon.prototype.allies = function () {
        var allies = this.side.active;
        if (this.battle.gameType === 'multi') {
            var team_1 = this.side.n % 2;
            // @ts-ignore
            allies = this.battle.sides.flatMap(function (side) {
                return side.n % 2 === team_1 ? side.active : [];
            });
        }
        return allies.filter(function (ally) { return ally && !ally.fainted; });
    };
    Pokemon.prototype.nearbyAllies = function () {
        var _this = this;
        return this.allies().filter(function (ally) { return _this.battle.isAdjacent(_this, ally); });
    };
    Pokemon.prototype.foes = function () {
        var foes = this.side.foe.active;
        if (this.battle.gameType === 'multi') {
            var team_2 = this.side.foe.n % 2;
            // @ts-ignore
            foes = this.battle.sides.flatMap(function (side) {
                return side.n % 2 === team_2 ? side.active : [];
            });
        }
        return foes.filter(function (foe) { return foe && !foe.fainted; });
    };
    Pokemon.prototype.nearbyFoes = function () {
        var _this = this;
        return this.foes().filter(function (foe) { return _this.battle.isAdjacent(_this, foe); });
    };
    Pokemon.prototype.getMoveTargets = function (move, target) {
        var targets = [];
        var pressureTargets;
        switch (move.target) {
            case 'all':
            case 'foeSide':
            case 'allySide':
            case 'allyTeam':
                if (!move.target.startsWith('foe')) {
                    targets.push.apply(targets, this.allies());
                }
                if (!move.target.startsWith('ally')) {
                    targets.push.apply(targets, this.foes());
                }
                if (targets.length && !targets.includes(target)) {
                    this.battle.retargetLastMove(targets[targets.length - 1]);
                }
                break;
            case 'allAdjacent':
                targets.push.apply(targets, this.nearbyAllies());
            // falls through
            case 'allAdjacentFoes':
                targets.push.apply(targets, this.nearbyFoes());
                if (targets.length && !targets.includes(target)) {
                    this.battle.retargetLastMove(targets[targets.length - 1]);
                }
                break;
            default:
                var selectedTarget = target;
                if (!target || (target.fainted && target.side !== this.side)) {
                    // If a targeted foe faints, the move is retargeted
                    var possibleTarget = this.battle.resolveTarget(this, move);
                    if (!possibleTarget)
                        return { targets: [], pressureTargets: [] };
                    target = possibleTarget;
                }
                if (target.side.active.length > 1) {
                    if (!move.flags['charge'] || this.volatiles['twoturnmove'] ||
                        (move.id.startsWith('solarb') && this.battle.field.isWeather(['sunnyday', 'desolateland'])) ||
                        (this.hasItem('powerherb') && move.id !== 'skydrop')) {
                        target = this.battle.priorityEvent('RedirectTarget', this, this, this.battle.dex.getActiveMove(move), target);
                    }
                }
                if (target.fainted) {
                    return { targets: [], pressureTargets: [] };
                }
                if (selectedTarget !== target) {
                    this.battle.retargetLastMove(target);
                }
                targets.push(target);
                // Resolve apparent targets for Pressure.
                if (move.pressureTarget) {
                    // At the moment, this is the only supported target.
                    if (move.pressureTarget === 'foeSide') {
                        pressureTargets = this.foes();
                    }
                }
        }
        return { targets: targets, pressureTargets: pressureTargets || targets };
    };
    Pokemon.prototype.ignoringAbility = function () {
        var abilities = [
            'battlebond', 'comatose', 'disguise', 'multitype', 'powerconstruct', 'rkssystem', 'schooling', 'shieldsdown', 'stancechange',
        ];
        return !!((this.battle.gen >= 5 && !this.isActive) ||
            (this.volatiles['gastroacid'] && !abilities.includes(this.ability)));
    };
    Pokemon.prototype.ignoringItem = function () {
        return !!((this.battle.gen >= 5 && !this.isActive) ||
            (this.hasAbility('klutz') && !this.getItem().ignoreKlutz) ||
            this.volatiles['embargo'] || this.battle.field.pseudoWeather['magicroom']);
    };
    Pokemon.prototype.deductPP = function (move, amount, target) {
        var gen = this.battle.gen;
        move = this.battle.dex.getMove(move);
        var ppData = this.getMoveData(move);
        if (!ppData)
            return 0;
        ppData.used = true;
        if (!ppData.pp && gen > 1)
            return 0;
        if (!amount)
            amount = 1;
        ppData.pp -= amount;
        if (ppData.pp < 0 && gen > 1) {
            amount += ppData.pp;
            ppData.pp = 0;
        }
        return amount;
    };
    Pokemon.prototype.moveUsed = function (move, targetLoc) {
        this.lastMove = move;
        this.lastMoveTargetLoc = targetLoc;
        this.moveThisTurn = move.id;
    };
    Pokemon.prototype.gotAttacked = function (move, damage, source) {
        if (!damage)
            damage = 0;
        move = this.battle.dex.getMove(move);
        this.attackedBy.push({
            source: source,
            damage: damage,
            move: move.id,
            thisTurn: true
        });
    };
    Pokemon.prototype.getLastAttackedBy = function () {
        if (this.attackedBy.length === 0)
            return undefined;
        return this.attackedBy[this.attackedBy.length - 1];
    };
    Pokemon.prototype.getLockedMove = function () {
        var lockedMove = this.battle.runEvent('LockMove', this);
        return (lockedMove === true) ? null : lockedMove;
    };
    Pokemon.prototype.getMoves = function (lockedMove, restrictData) {
        if (lockedMove) {
            lockedMove = toID(lockedMove);
            this.trapped = true;
            if (lockedMove === 'recharge') {
                return [{
                        move: 'Recharge',
                        id: 'recharge'
                    }];
            }
            for (var _i = 0, _a = this.moveSlots; _i < _a.length; _i++) {
                var moveSlot = _a[_i];
                if (moveSlot.id !== lockedMove)
                    continue;
                return [{
                        move: moveSlot.move,
                        id: moveSlot.id
                    }];
            }
            // does this happen?
            return [{
                    move: this.battle.dex.getMove(lockedMove).name,
                    id: lockedMove
                }];
        }
        var moves = [];
        var hasValidMove = false;
        for (var _b = 0, _c = this.moveSlots; _b < _c.length; _b++) {
            var moveSlot = _c[_b];
            var moveName = moveSlot.move;
            if (moveSlot.id === 'hiddenpower') {
                moveName = 'Hidden Power ' + this.hpType;
                if (this.battle.gen < 6)
                    moveName += ' ' + this.hpPower;
            }
            else if (moveSlot.id === 'return') {
                // @ts-ignore - Return's basePowerCallback only takes one parameter
                moveName = 'Return ' + this.battle.dex.getMove('return').basePowerCallback(this);
            }
            else if (moveSlot.id === 'frustration') {
                // @ts-ignore - Frustration's basePowerCallback only takes one parameter
                moveName = 'Frustration ' + this.battle.dex.getMove('frustration').basePowerCallback(this);
            }
            var target = moveSlot.target;
            if (moveSlot.id === 'curse') {
                if (!this.hasType('Ghost')) {
                    target = this.battle.dex.getMove('curse').nonGhostTarget || moveSlot.target;
                }
            }
            var disabled = moveSlot.disabled;
            if ((moveSlot.pp <= 0 && !this.volatiles['partialtrappinglock']) || disabled &&
                this.side.active.length >= 2 && this.battle.targetTypeChoices(target)) {
                disabled = true;
            }
            else if (disabled === 'hidden' && restrictData) {
                disabled = false;
            }
            if (!disabled) {
                hasValidMove = true;
            }
            moves.push({
                move: moveName,
                id: moveSlot.id,
                pp: moveSlot.pp,
                maxpp: moveSlot.maxpp,
                target: target,
                disabled: disabled
            });
        }
        return hasValidMove ? moves : [];
    };
    Pokemon.prototype.getRequestData = function () {
        var lockedMove = this.getLockedMove();
        // Information should be restricted for the last active Pokémon
        var isLastActive = this.isLastActive();
        var canSwitchIn = this.battle.canSwitch(this.side) > 0;
        var moves = this.getMoves(lockedMove, isLastActive);
        var data = { moves: moves.length ? moves : [{ move: 'Struggle', id: 'struggle', target: 'randomNormal', disabled: false }] };
        if (isLastActive) {
            if (this.maybeDisabled) {
                data.maybeDisabled = true;
            }
            if (canSwitchIn) {
                if (this.trapped === true) {
                    data.trapped = true;
                }
                else if (this.maybeTrapped) {
                    data.maybeTrapped = true;
                }
            }
        }
        else if (canSwitchIn) {
            // Discovered by selecting a valid Pokémon as a switch target and cancelling.
            if (this.trapped)
                data.trapped = true;
        }
        if (!lockedMove) {
            if (this.canMegaEvo)
                data.canMegaEvo = true;
            if (this.canUltraBurst)
                data.canUltraBurst = true;
            var canZMove = this.battle.canZMove(this);
            if (canZMove)
                data.canZMove = canZMove;
        }
        return data;
    };
    Pokemon.prototype.isLastActive = function () {
        if (!this.isActive)
            return false;
        var allyActive = this.side.active;
        for (var i = this.position + 1; i < allyActive.length; i++) {
            if (allyActive[i] && !allyActive[i].fainted)
                return false;
        }
        return true;
    };
    Pokemon.prototype.positiveBoosts = function () {
        var boosts = 0;
        var boost;
        for (boost in this.boosts) {
            if (this.boosts[boost] > 0)
                boosts += this.boosts[boost];
        }
        return boosts;
    };
    Pokemon.prototype.boostBy = function (boosts) {
        var delta = 0;
        var boostName;
        for (boostName in boosts) {
            delta = boosts[boostName];
            this.boosts[boostName] += delta;
            if (this.boosts[boostName] > 6) {
                delta -= this.boosts[boostName] - 6;
                this.boosts[boostName] = 6;
            }
            if (this.boosts[boostName] < -6) {
                delta -= this.boosts[boostName] - (-6);
                this.boosts[boostName] = -6;
            }
        }
        return delta;
    };
    Pokemon.prototype.clearBoosts = function () {
        var boostName;
        for (boostName in this.boosts) {
            this.boosts[boostName] = 0;
        }
    };
    Pokemon.prototype.setBoost = function (boosts) {
        var boostName;
        for (boostName in boosts) {
            this.boosts[boostName] = boosts[boostName];
        }
    };
    Pokemon.prototype.copyVolatileFrom = function (pokemon) {
        this.clearVolatile();
        this.boosts = pokemon.boosts;
        for (var i in pokemon.volatiles) {
            if (this.battle.dex.getEffectByID(i).noCopy)
                continue;
            // shallow clones
            this.volatiles[i] = Object.assign({}, pokemon.volatiles[i]);
            if (this.volatiles[i].linkedPokemon) {
                delete pokemon.volatiles[i].linkedPokemon;
                delete pokemon.volatiles[i].linkedStatus;
                for (var _i = 0, _a = this.volatiles[i].linkedPokemon; _i < _a.length; _i++) {
                    var linkedPoke = _a[_i];
                    var linkedPokeLinks = linkedPoke.volatiles[this.volatiles[i].linkedStatus].linkedPokemon;
                    linkedPokeLinks[linkedPokeLinks.indexOf(pokemon)] = this;
                }
            }
        }
        pokemon.clearVolatile();
        for (var i in this.volatiles) {
            var volatile = this.getVolatile(i);
            this.battle.singleEvent('Copy', volatile, this.volatiles[i], this);
        }
    };
    Pokemon.prototype.transformInto = function (pokemon, effect) {
        if (effect === void 0) { effect = null; }
        var template = pokemon.template;
        if (pokemon.fainted || pokemon.illusion || (pokemon.volatiles['substitute'] && this.battle.gen >= 5) ||
            (pokemon.transformed && this.battle.gen >= 2) || (this.transformed && this.battle.gen >= 5) ||
            !this.setTemplate(template)) {
            return false;
        }
        this.transformed = true;
        this.weighthg = pokemon.weighthg;
        var types = pokemon.getTypes(true);
        this.setType(pokemon.volatiles.roost ? pokemon.volatiles.roost.typeWas : types, true);
        this.addedType = pokemon.addedType;
        this.knownType = this.side === pokemon.side && pokemon.knownType;
        this.apparentType = pokemon.apparentType;
        var statName;
        for (statName in this.storedStats) {
            this.storedStats[statName] = pokemon.storedStats[statName];
        }
        this.moveSlots = [];
        this.set.ivs = (this.battle.gen >= 5 ? this.set.ivs : pokemon.set.ivs);
        this.hpType = (this.battle.gen >= 5 ? this.hpType : pokemon.hpType);
        this.hpPower = (this.battle.gen >= 5 ? this.hpPower : pokemon.hpPower);
        for (var _i = 0, _a = pokemon.moveSlots; _i < _a.length; _i++) {
            var moveSlot = _a[_i];
            var moveName = moveSlot.move;
            if (moveSlot.id === 'hiddenpower') {
                moveName = 'Hidden Power ' + this.hpType;
            }
            this.moveSlots.push({
                move: moveName,
                id: moveSlot.id,
                pp: moveSlot.maxpp === 1 ? 1 : 5,
                maxpp: this.battle.gen >= 5 ? (moveSlot.maxpp === 1 ? 1 : 5) : moveSlot.maxpp,
                target: moveSlot.target,
                disabled: false,
                used: false,
                virtual: true
            });
        }
        var boostName;
        for (boostName in pokemon.boosts) {
            this.boosts[boostName] = pokemon.boosts[boostName];
        }
        if (this.battle.gen >= 6 && pokemon.volatiles['focusenergy'])
            this.addVolatile('focusenergy');
        if (pokemon.volatiles['laserfocus'])
            this.addVolatile('laserfocus');
        if (effect) {
            this.battle.add('-transform', this, pokemon, '[from] ' + effect.fullname);
        }
        else {
            this.battle.add('-transform', this, pokemon);
        }
        if (this.battle.gen > 2)
            this.setAbility(pokemon.ability, this, true);
        // Change formes based on held items (for Transform)
        // Only ever relevant in Generation 4 since Generation 3 didn't have item-based forme changes
        if (this.battle.gen === 4) {
            if (this.template.num === 487) {
                // Giratina formes
                if (this.template.species === 'Giratina' && this.item === 'griseousorb') {
                    this.formeChange('Giratina-Origin');
                }
                else if (this.template.species === 'Giratina-Origin' && this.item !== 'griseousorb') {
                    this.formeChange('Giratina');
                }
            }
            if (this.template.num === 493) {
                // Arceus formes
                var item = this.getItem();
                var targetForme = (item && item.onPlate ? 'Arceus-' + item.onPlate : 'Arceus');
                if (this.template.species !== targetForme) {
                    this.formeChange(targetForme);
                }
            }
        }
        return true;
    };
    /**
     * Changes this Pokemon's template to the given templateId (or template).
     * This function only handles changes to stats and type.
     * Use formChange to handle changes to ability and sending client messages.
     */
    Pokemon.prototype.setTemplate = function (rawTemplate, source) {
        if (source === void 0) { source = this.battle.effect; }
        var template = this.battle.runEvent('ModifyTemplate', this, null, source, rawTemplate);
        if (!template)
            return null;
        this.template = template;
        this.setType(template.types, true);
        this.apparentType = rawTemplate.types.join('/');
        this.addedType = template.addedType || '';
        this.knownType = true;
        this.weighthg = template.weighthg;
        var stats = this.battle.dex.spreadModify(this.template.baseStats, this.set);
        if (!this.baseStoredStats)
            this.baseStoredStats = stats;
        var statName;
        for (statName in this.storedStats) {
            this.storedStats[statName] = stats[statName];
            this.baseStoredStats[statName] = stats[statName];
            if (this.modifiedStats)
                this.modifiedStats[statName] = stats[statName]; // Gen 1: Reset modified stats.
        }
        if (this.battle.gen <= 1) {
            // Gen 1: Re-Apply burn and para drops.
            if (this.status === 'par')
                this.modifyStat('spe', 0.25);
            if (this.status === 'brn')
                this.modifyStat('atk', 0.5);
        }
        this.speed = this.storedStats.spe;
        return template;
    };
    /**
     * Changes this Pokemon's forme to match the given templateId (or template).
     * This function handles all changes to stats, ability, type, template, etc.
     * as well as sending all relevant messages sent to the client.
     */
    Pokemon.prototype.formeChange = function (templateId, source, isPermanent, message, abilitySlot) {
        if (source === void 0) { source = this.battle.effect; }
        if (abilitySlot === void 0) { abilitySlot = '0'; }
        var rawTemplate = this.battle.dex.getTemplate(templateId);
        var template = this.setTemplate(rawTemplate, source);
        if (!template)
            return false;
        if (this.battle.gen <= 2)
            return true;
        // The species the opponent sees
        var apparentSpecies = this.illusion ? this.illusion.template.species : template.baseSpecies;
        if (isPermanent) {
            this.baseTemplate = rawTemplate;
            this.details = template.species + (this.level === 100 ? '' : ', L' + this.level) +
                (this.gender === '' ? '' : ', ' + this.gender) + (this.set.shiny ? ', shiny' : '');
            this.battle.add('detailschange', this, (this.illusion || this).details);
            if (source.effectType === 'Item') {
                if (source.zMove) {
                    this.battle.add('-burst', this, apparentSpecies, template.requiredItem);
                    this.moveThisTurnResult = true; // Ultra Burst counts as an action for Truant
                }
                else if (source.onPrimal) {
                    if (this.illusion) {
                        this.ability = '';
                        this.battle.add('-primal', this.illusion);
                    }
                    else {
                        this.battle.add('-primal', this);
                    }
                }
                else {
                    this.battle.add('-mega', this, apparentSpecies, template.requiredItem);
                    this.moveThisTurnResult = true; // Mega Evolution counts as an action for Truant
                }
            }
            else if (source.effectType === 'Status') {
                // Shaymin-Sky -> Shaymin
                this.battle.add('-formechange', this, template.species, message);
            }
        }
        else {
            if (source.effectType === 'Ability') {
                this.battle.add('-formechange', this, template.species, message, "[from] ability: " + source.name);
            }
            else {
                this.battle.add('-formechange', this, this.illusion ? this.illusion.template.species : template.species, message);
            }
        }
        if (source.effectType !== 'Ability' && source.id !== 'relicsong' && source.id !== 'zenmode') {
            if (this.illusion) {
                this.ability = ''; // Don't allow Illusion to wear off
            }
            this.setAbility(template.abilities[abilitySlot], null, true);
            if (isPermanent)
                this.baseAbility = this.ability;
        }
        return true;
    };
    Pokemon.prototype.clearVolatile = function (includeSwitchFlags) {
        if (includeSwitchFlags === void 0) { includeSwitchFlags = true; }
        this.boosts = {
            atk: 0,
            def: 0,
            spa: 0,
            spd: 0,
            spe: 0,
            accuracy: 0,
            evasion: 0
        };
        if (this.battle.gen === 1 && this.baseMoves.includes('mimic') && !this.transformed) {
            var moveslot = this.baseMoves.indexOf('mimic');
            var mimicPP = this.moveSlots[moveslot] ? this.moveSlots[moveslot].pp : 16;
            this.moveSlots = this.baseMoveSlots.slice();
            this.moveSlots[moveslot].pp = mimicPP;
        }
        else {
            this.moveSlots = this.baseMoveSlots.slice();
        }
        this.transformed = false;
        this.ability = this.baseAbility;
        this.hpType = this.baseHpType;
        this.hpPower = this.baseHpPower;
        for (var i in this.volatiles) {
            if (this.volatiles[i].linkedStatus) {
                this.removeLinkedVolatiles(this.volatiles[i].linkedStatus, this.volatiles[i].linkedPokemon);
            }
        }
        this.volatiles = {};
        if (includeSwitchFlags) {
            this.switchFlag = false;
            this.forceSwitchFlag = false;
        }
        this.lastMove = null;
        this.moveThisTurn = '';
        this.lastDamage = 0;
        this.attackedBy = [];
        this.hurtThisTurn = false;
        this.newlySwitched = true;
        this.beingCalledBack = false;
        this.setTemplate(this.baseTemplate);
    };
    Pokemon.prototype.hasType = function (type) {
        if (!type)
            return false;
        if (Array.isArray(type)) {
            for (var _i = 0, type_1 = type; _i < type_1.length; _i++) {
                var typeid = type_1[_i];
                if (this.hasType(typeid))
                    return true;
            }
        }
        else {
            if (this.getTypes().includes(type)) {
                return true;
            }
        }
        return false;
    };
    /**
     * This function only puts the pokemon in the faint queue;
     * actually setting of this.fainted comes later when the
     * faint queue is resolved.
     *
     * Returns the amount of damage actually dealt
     */
    Pokemon.prototype.faint = function (source, effect) {
        if (source === void 0) { source = null; }
        if (effect === void 0) { effect = null; }
        if (this.fainted || this.faintQueued)
            return 0;
        var d = this.hp;
        this.hp = 0;
        this.switchFlag = false;
        this.faintQueued = true;
        this.battle.faintQueue.push({
            target: this,
            source: source,
            effect: effect
        });
        return d;
    };
    Pokemon.prototype.damage = function (d, source, effect) {
        if (source === void 0) { source = null; }
        if (effect === void 0) { effect = null; }
        if (!this.hp || isNaN(d) || d <= 0)
            return 0;
        if (d < 1 && d > 0)
            d = 1;
        d = this.battle.trunc(d);
        this.hp -= d;
        if (this.hp <= 0) {
            d += this.hp;
            this.faint(source, effect);
        }
        return d;
    };
    Pokemon.prototype.tryTrap = function (isHidden) {
        if (isHidden === void 0) { isHidden = false; }
        if (!this.runStatusImmunity('trapped'))
            return false;
        if (this.trapped && isHidden)
            return true;
        this.trapped = isHidden ? 'hidden' : true;
        return true;
    };
    Pokemon.prototype.hasMove = function (moveid) {
        moveid = toID(moveid);
        if (moveid.substr(0, 11) === 'hiddenpower')
            moveid = 'hiddenpower';
        for (var _i = 0, _a = this.moveSlots; _i < _a.length; _i++) {
            var moveSlot = _a[_i];
            if (moveid === moveSlot.id) {
                return moveid;
            }
        }
        return false;
    };
    Pokemon.prototype.disableMove = function (moveid, isHidden, sourceEffect) {
        if (!sourceEffect && this.battle.event) {
            sourceEffect = this.battle.effect;
        }
        moveid = toID(moveid);
        for (var _i = 0, _a = this.moveSlots; _i < _a.length; _i++) {
            var moveSlot = _a[_i];
            if (moveSlot.id === moveid && moveSlot.disabled !== true) {
                moveSlot.disabled = (isHidden || true);
                moveSlot.disabledSource = (sourceEffect ? sourceEffect.fullname : '');
            }
        }
    };
    /** Returns the amount of damage actually healed */
    Pokemon.prototype.heal = function (d, source, effect) {
        if (source === void 0) { source = null; }
        if (effect === void 0) { effect = null; }
        if (!this.hp)
            return false;
        d = this.battle.trunc(d);
        if (isNaN(d))
            return false;
        if (d <= 0)
            return false;
        if (this.hp >= this.maxhp)
            return false;
        this.hp += d;
        if (this.hp > this.maxhp) {
            d -= this.hp - this.maxhp;
            this.hp = this.maxhp;
        }
        return d;
    };
    /** Sets HP, returns delta */
    Pokemon.prototype.sethp = function (d) {
        if (!this.hp)
            return 0;
        d = this.battle.trunc(d);
        if (isNaN(d))
            return;
        if (d < 1)
            d = 1;
        d = d - this.hp;
        this.hp += d;
        if (this.hp > this.maxhp) {
            d -= this.hp - this.maxhp;
            this.hp = this.maxhp;
        }
        return d;
    };
    Pokemon.prototype.trySetStatus = function (status, source, sourceEffect) {
        if (source === void 0) { source = null; }
        if (sourceEffect === void 0) { sourceEffect = null; }
        return this.setStatus(this.status || status, source, sourceEffect);
    };
    /** Unlike clearStatus, gives cure message */
    Pokemon.prototype.cureStatus = function (silent) {
        if (silent === void 0) { silent = false; }
        if (!this.hp || !this.status)
            return false;
        this.battle.add('-curestatus', this, this.status, silent ? '[silent]' : '[msg]');
        if (this.status === 'slp' && !this.hasAbility('comatose') && this.removeVolatile('nightmare')) {
            this.battle.add('-end', this, 'Nightmare', '[silent]');
        }
        this.setStatus('');
        return true;
    };
    Pokemon.prototype.setStatus = function (status, source, sourceEffect, ignoreImmunities) {
        if (source === void 0) { source = null; }
        if (sourceEffect === void 0) { sourceEffect = null; }
        if (ignoreImmunities === void 0) { ignoreImmunities = false; }
        if (!this.hp)
            return false;
        status = this.battle.dex.getEffect(status);
        if (this.battle.event) {
            if (!source)
                source = this.battle.event.source;
            if (!sourceEffect)
                sourceEffect = this.battle.effect;
        }
        if (!source)
            source = this;
        if (this.status === status.id) {
            if (sourceEffect && sourceEffect.status === this.status) {
                this.battle.add('-fail', this, this.status);
            }
            else if (sourceEffect && sourceEffect.status) {
                this.battle.add('-fail', source);
                this.battle.attrLastMove('[still]');
            }
            return false;
        }
        if (!ignoreImmunities && status.id &&
            !(source && source.hasAbility('corrosion') && ['tox', 'psn'].includes(status.id))) {
            // the game currently never ignores immunities
            if (!this.runStatusImmunity(status.id === 'tox' ? 'psn' : status.id)) {
                this.battle.debug('immune to status');
                if (sourceEffect && sourceEffect.status)
                    this.battle.add('-immune', this);
                return false;
            }
        }
        var prevStatus = this.status;
        var prevStatusData = this.statusData;
        if (status.id) {
            var result = this.battle.runEvent('SetStatus', this, source, sourceEffect, status);
            if (!result) {
                this.battle.debug('set status [' + status.id + '] interrupted');
                return result;
            }
        }
        this.status = status.id;
        this.statusData = { id: status.id, target: this };
        if (source)
            this.statusData.source = source;
        if (status.duration)
            this.statusData.duration = status.duration;
        if (status.durationCallback) {
            this.statusData.duration = status.durationCallback.call(this.battle, this, source, sourceEffect);
        }
        if (status.id && !this.battle.singleEvent('Start', status, this.statusData, this, source, sourceEffect)) {
            this.battle.debug('status start [' + status.id + '] interrupted');
            // cancel the setstatus
            this.status = prevStatus;
            this.statusData = prevStatusData;
            return false;
        }
        if (status.id && !this.battle.runEvent('AfterSetStatus', this, source, sourceEffect, status)) {
            return false;
        }
        return true;
    };
    /**
     * Unlike cureStatus, does not give cure message
     */
    Pokemon.prototype.clearStatus = function () {
        return this.setStatus('');
    };
    Pokemon.prototype.getStatus = function () {
        return this.battle.dex.getEffectByID(this.status);
    };
    Pokemon.prototype.eatItem = function (source, sourceEffect) {
        if (!this.hp || !this.isActive)
            return false;
        if (!this.item)
            return false;
        if (!sourceEffect && this.battle.effect)
            sourceEffect = this.battle.effect;
        if (!source && this.battle.event && this.battle.event.target)
            source = this.battle.event.target;
        var item = this.getItem();
        if (this.battle.runEvent('UseItem', this, null, null, item) &&
            this.battle.runEvent('TryEatItem', this, null, null, item)) {
            this.battle.add('-enditem', this, item, '[eat]');
            this.battle.singleEvent('Eat', item, this.itemData, this, source, sourceEffect);
            this.battle.runEvent('EatItem', this, null, null, item);
            if (item.id === 'leppaberry') {
                switch (this.pendingStaleness) {
                    case 'internal':
                        if (this.staleness !== 'external')
                            this.staleness = 'internal';
                        break;
                    case 'external':
                        this.staleness = 'external';
                        break;
                }
                this.pendingStaleness = undefined;
            }
            this.lastItem = this.item;
            this.item = '';
            this.itemData = { id: '', target: this };
            this.usedItemThisTurn = true;
            this.ateBerry = true;
            this.battle.runEvent('AfterUseItem', this, null, null, item);
            return true;
        }
        return false;
    };
    Pokemon.prototype.useItem = function (source, sourceEffect) {
        if ((!this.hp && !this.getItem().isGem) || !this.isActive)
            return false;
        if (!this.item)
            return false;
        if (!sourceEffect && this.battle.effect)
            sourceEffect = this.battle.effect;
        if (!source && this.battle.event && this.battle.event.target)
            source = this.battle.event.target;
        var item = this.getItem();
        if (this.battle.runEvent('UseItem', this, null, null, item)) {
            switch (item.id) {
                case 'redcard':
                    this.battle.add('-enditem', this, item, '[of] ' + source);
                    break;
                default:
                    if (!item.isGem) {
                        this.battle.add('-enditem', this, item);
                    }
                    break;
            }
            this.battle.singleEvent('Use', item, this.itemData, this, source, sourceEffect);
            this.lastItem = this.item;
            this.item = '';
            this.itemData = { id: '', target: this };
            this.usedItemThisTurn = true;
            this.battle.runEvent('AfterUseItem', this, null, null, item);
            return true;
        }
        return false;
    };
    Pokemon.prototype.takeItem = function (source) {
        if (!this.isActive)
            return false;
        if (!this.item)
            return false;
        if (!source)
            source = this;
        if (this.battle.gen === 4) {
            if (toID(this.ability) === 'multitype')
                return false;
            if (source && toID(source.ability) === 'multitype')
                return false;
        }
        var item = this.getItem();
        if (this.battle.runEvent('TakeItem', this, source, null, item)) {
            this.item = '';
            this.itemData = { id: '', target: this };
            this.pendingStaleness = undefined;
            return item;
        }
        return false;
    };
    Pokemon.prototype.setItem = function (item, source, effect) {
        if (!this.hp || !this.isActive)
            return false;
        if (typeof item === 'string')
            item = this.battle.dex.getItem(item);
        var effectid = this.battle.effect ? this.battle.effect.id : '';
        if (item.id === 'leppaberry') {
            var inflicted = ['trick', 'switcheroo'].includes(effectid);
            var external_1 = inflicted && source && source.side.id !== this.side.id;
            this.pendingStaleness = external_1 ? 'external' : 'internal';
        }
        else {
            this.pendingStaleness = undefined;
        }
        this.item = item.id;
        this.itemData = { id: item.id, target: this };
        if (item.id) {
            this.battle.singleEvent('Start', item, this.itemData, this, source, effect);
        }
        return true;
    };
    Pokemon.prototype.getItem = function () {
        return this.battle.dex.getItem(this.item);
    };
    Pokemon.prototype.hasItem = function (item) {
        if (this.ignoringItem())
            return false;
        var ownItem = this.item;
        if (!Array.isArray(item))
            return ownItem === toID(item);
        return item.map(toID).includes(ownItem);
    };
    Pokemon.prototype.clearItem = function () {
        return this.setItem('');
    };
    Pokemon.prototype.setAbility = function (ability, source, isFromFormeChange) {
        if (!this.hp)
            return false;
        if (typeof ability === 'string')
            ability = this.battle.dex.getAbility(ability);
        var oldAbility = this.ability;
        if (!isFromFormeChange) {
            var abilities = [
                'battlebond', 'comatose', 'disguise', 'multitype', 'powerconstruct', 'rkssystem', 'schooling', 'shieldsdown', 'stancechange',
            ];
            if ('illusion' === ability.id || abilities.includes(ability.id) || abilities.includes(oldAbility))
                return false;
            if (this.battle.gen >= 7 && (ability.id === 'zenmode' || oldAbility === 'zenmode'))
                return false;
        }
        if (!this.battle.runEvent('SetAbility', this, source, this.battle.effect, ability))
            return false;
        this.battle.singleEvent('End', this.battle.dex.getAbility(oldAbility), this.abilityData, this, source);
        if (this.battle.effect && this.battle.effect.effectType === 'Move') {
            this.battle.add('-endability', this, this.battle.dex.getAbility(oldAbility), '[from] move: ' +
                this.battle.dex.getMove(this.battle.effect.id));
        }
        this.ability = ability.id;
        this.abilityData = { id: ability.id, target: this };
        if (ability.id && this.battle.gen > 3) {
            this.battle.singleEvent('Start', ability, this.abilityData, this, source);
        }
        this.abilityOrder = this.battle.abilityOrder++;
        return oldAbility;
    };
    Pokemon.prototype.getAbility = function () {
        return this.battle.dex.getAbility(this.ability);
    };
    Pokemon.prototype.hasAbility = function (ability) {
        if (this.ignoringAbility())
            return false;
        var ownAbility = this.ability;
        if (!Array.isArray(ability))
            return ownAbility === toID(ability);
        return ability.map(toID).includes(ownAbility);
    };
    Pokemon.prototype.clearAbility = function () {
        return this.setAbility('');
    };
    Pokemon.prototype.getNature = function () {
        return this.battle.dex.getNature(this.set.nature);
    };
    Pokemon.prototype.addVolatile = function (status, source, sourceEffect, linkedStatus) {
        if (source === void 0) { source = null; }
        if (sourceEffect === void 0) { sourceEffect = null; }
        if (linkedStatus === void 0) { linkedStatus = null; }
        var result;
        status = this.battle.dex.getEffect(status);
        if (!this.hp && !status.affectsFainted)
            return false;
        if (linkedStatus && source && !source.hp)
            return false;
        if (this.battle.event) {
            if (!source)
                source = this.battle.event.source;
            if (!sourceEffect)
                sourceEffect = this.battle.effect;
        }
        if (!source)
            source = this;
        if (this.volatiles[status.id]) {
            if (!status.onRestart)
                return false;
            return this.battle.singleEvent('Restart', status, this.volatiles[status.id], this, source, sourceEffect);
        }
        if (!this.runStatusImmunity(status.id)) {
            this.battle.debug('immune to volatile status');
            if (sourceEffect && sourceEffect.status)
                this.battle.add('-immune', this);
            return false;
        }
        result = this.battle.runEvent('TryAddVolatile', this, source, sourceEffect, status);
        if (!result) {
            this.battle.debug('add volatile [' + status.id + '] interrupted');
            return result;
        }
        this.volatiles[status.id] = { id: status.id };
        this.volatiles[status.id].target = this;
        if (source) {
            this.volatiles[status.id].source = source;
            this.volatiles[status.id].sourcePosition = source.position;
        }
        if (sourceEffect)
            this.volatiles[status.id].sourceEffect = sourceEffect;
        if (status.duration)
            this.volatiles[status.id].duration = status.duration;
        if (status.durationCallback) {
            this.volatiles[status.id].duration = status.durationCallback.call(this.battle, this, source, sourceEffect);
        }
        result = this.battle.singleEvent('Start', status, this.volatiles[status.id], this, source, sourceEffect);
        if (!result) {
            // cancel
            delete this.volatiles[status.id];
            return result;
        }
        if (linkedStatus && source) {
            if (!source.volatiles[linkedStatus.toString()]) {
                source.addVolatile(linkedStatus, this, sourceEffect);
                source.volatiles[linkedStatus.toString()].linkedPokemon = [this];
                source.volatiles[linkedStatus.toString()].linkedStatus = status;
            }
            else {
                source.volatiles[linkedStatus.toString()].linkedPokemon.push(this);
            }
            this.volatiles[status.toString()].linkedPokemon = [source];
            this.volatiles[status.toString()].linkedStatus = linkedStatus;
        }
        return true;
    };
    Pokemon.prototype.getVolatile = function (status) {
        status = this.battle.dex.getEffect(status);
        if (!this.volatiles[status.id])
            return null;
        return status;
    };
    Pokemon.prototype.removeVolatile = function (status) {
        if (!this.hp)
            return false;
        status = this.battle.dex.getEffect(status);
        if (!this.volatiles[status.id])
            return false;
        this.battle.singleEvent('End', status, this.volatiles[status.id], this);
        var linkedPokemon = this.volatiles[status.id].linkedPokemon;
        var linkedStatus = this.volatiles[status.id].linkedStatus;
        delete this.volatiles[status.id];
        if (linkedPokemon) {
            this.removeLinkedVolatiles(linkedStatus, linkedPokemon);
        }
        return true;
    };
    Pokemon.prototype.removeLinkedVolatiles = function (linkedStatus, linkedPokemon) {
        linkedStatus = linkedStatus.toString();
        for (var _i = 0, linkedPokemon_1 = linkedPokemon; _i < linkedPokemon_1.length; _i++) {
            var linkedPoke = linkedPokemon_1[_i];
            var volatileData = linkedPoke.volatiles[linkedStatus];
            if (!volatileData)
                continue;
            volatileData.linkedPokemon.splice(volatileData.linkedPokemon.indexOf(this), 1);
            if (volatileData.linkedPokemon.length === 0) {
                linkedPoke.removeVolatile(linkedStatus);
            }
        }
    };
    /**
     * Sets a type (except on Arceus, who resists type changes)
     * newType can be an array, but this is for OMs only. The game in
     * reality doesn't support setting a type to more than one type.
     */
    Pokemon.prototype.setType = function (newType, enforce) {
        if (enforce === void 0) { enforce = false; }
        // First type of Arceus, Silvally cannot be normally changed
        if (!enforce && (this.template.num === 493 || this.template.num === 773))
            return false;
        if (!newType)
            throw new Error("Must pass type to setType");
        this.types = (typeof newType === 'string' ? [newType] : newType);
        this.addedType = '';
        this.knownType = true;
        this.apparentType = this.types.join('/');
        return true;
    };
    /** Removes any types added previously and adds another one. */
    Pokemon.prototype.addType = function (newType) {
        this.addedType = newType;
        return true;
    };
    Pokemon.prototype.getTypes = function (excludeAdded) {
        var types = this.battle.runEvent('Type', this, null, null, this.types);
        if (!excludeAdded && this.addedType)
            return types.concat(this.addedType);
        if (types.length)
            return types;
        return [this.battle.gen >= 5 ? 'Normal' : '???'];
    };
    Pokemon.prototype.isGrounded = function (negateImmunity) {
        if (negateImmunity === void 0) { negateImmunity = false; }
        if ('gravity' in this.battle.field.pseudoWeather)
            return true;
        if ('ingrain' in this.volatiles && this.battle.gen >= 4)
            return true;
        if ('smackdown' in this.volatiles)
            return true;
        var item = (this.ignoringItem() ? '' : this.item);
        if (item === 'ironball')
            return true;
        // If a Fire/Flying type uses Burn Up and Roost, it becomes ???/Flying-type, but it's still grounded.
        if (!negateImmunity && this.hasType('Flying') && !('roost' in this.volatiles))
            return false;
        if (this.hasAbility('levitate') && !this.battle.suppressingAttackEvents())
            return null;
        if ('magnetrise' in this.volatiles)
            return false;
        if ('telekinesis' in this.volatiles)
            return false;
        return item !== 'airballoon';
    };
    Pokemon.prototype.isSemiInvulnerable = function () {
        return (this.volatiles['fly'] || this.volatiles['bounce'] || this.volatiles['dive'] || this.volatiles['dig'] ||
            this.volatiles['phantomforce'] || this.volatiles['shadowforce'] || this.isSkyDropped());
    };
    Pokemon.prototype.isSkyDropped = function () {
        if (this.volatiles['skydrop'])
            return true;
        for (var _i = 0, _a = this.side.foe.active; _i < _a.length; _i++) {
            var foeActive = _a[_i];
            if (foeActive.volatiles['skydrop'] && foeActive.volatiles['skydrop'].source === this) {
                return true;
            }
        }
        return false;
    };
    Pokemon.prototype.runEffectiveness = function (move) {
        var totalTypeMod = 0;
        for (var _i = 0, _a = this.getTypes(); _i < _a.length; _i++) {
            var type = _a[_i];
            var typeMod = this.battle.dex.getEffectiveness(move, type);
            typeMod = this.battle.singleEvent('Effectiveness', move, null, this, type, move, typeMod);
            totalTypeMod += this.battle.runEvent('Effectiveness', this, type, move, typeMod);
        }
        return totalTypeMod;
    };
    Pokemon.prototype.runImmunity = function (type, message) {
        if (!type || type === '???')
            return true;
        if (!(type in this.battle.dex.data.TypeChart)) {
            if (type === 'Fairy' || type === 'Dark' || type === 'Steel')
                return true;
            throw new Error("Use runStatusImmunity for " + type);
        }
        if (this.fainted)
            return false;
        var negateResult = this.battle.runEvent('NegateImmunity', this, type);
        var isGrounded;
        if (type === 'Ground') {
            isGrounded = this.isGrounded(!negateResult);
            if (isGrounded === null) {
                if (message) {
                    this.battle.add('-immune', this, '[from] ability: Levitate');
                }
                return false;
            }
        }
        if (!negateResult)
            return true;
        if ((isGrounded === undefined && !this.battle.dex.getImmunity(type, this)) || isGrounded === false) {
            if (message) {
                this.battle.add('-immune', this);
            }
            return false;
        }
        return true;
    };
    Pokemon.prototype.runStatusImmunity = function (type, message) {
        if (this.fainted)
            return false;
        if (!type)
            return true;
        if (!this.battle.dex.getImmunity(type, this)) {
            this.battle.debug('natural status immunity');
            if (message) {
                this.battle.add('-immune', this);
            }
            return false;
        }
        var immunity = this.battle.runEvent('Immunity', this, null, null, type);
        if (!immunity) {
            this.battle.debug('artificial status immunity');
            if (message && immunity !== null) {
                this.battle.add('-immune', this);
            }
            return false;
        }
        return true;
    };
    Pokemon.prototype.destroy = function () {
        // deallocate ourself
        // get rid of some possibly-circular references
        // @ts-ignore - readonly
        this.battle = null;
        // @ts-ignore - readonly
        this.side = null;
    };
    return Pokemon;
}());
exports.Pokemon = Pokemon;
