"use strict";
exports.__esModule = true;
var pokemon_1 = require("./pokemon");
var state_1 = require("./state");
var Side = /** @class */ (function () {
    function Side(name, battle, sideNum, team) {
        var sideScripts = battle.dex.data.Scripts.side;
        if (sideScripts)
            Object.assign(this, sideScripts);
        this.battle = battle;
        this.id = ['p1', 'p2', 'p3', 'p4'][sideNum];
        this.n = sideNum;
        this.name = name;
        this.avatar = '';
        this.maxTeamSize = 6;
        this.foe = sideNum ? this.battle.sides[0] : this.battle.sides[1];
        this.team = team;
        this.pokemon = [];
        for (var i = 0; i < this.team.length && i < 24; i++) {
            // console.log("NEW POKEMON: " + (this.team[i] ? this.team[i].name : '[unidentified]'));
            this.pokemon.push(new pokemon_1.Pokemon(this.team[i], this));
        }
        for (var _i = 0, _a = this.pokemon.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], i = _b[0], pokemon = _b[1];
            pokemon.position = i;
        }
        switch (this.battle.gameType) {
            case 'doubles':
                this.active = [null, null];
                break;
            case 'triples':
            case 'rotation':
                this.active = [null, null, null];
                break;
            default:
                this.active = [null];
        }
        this.pokemonLeft = this.pokemon.length;
        this.faintedLastTurn = false;
        this.faintedThisTurn = false;
        this.zMoveUsed = false;
        this.sideConditions = {};
        this.slotConditions = [];
        // Array#fill doesn't work for this
        for (var i = 0; i < this.active.length; i++)
            this.slotConditions[i] = {};
        this.activeRequest = null;
        this.choice = {
            cantUndo: false,
            error: "",
            actions: [],
            forcedSwitchesLeft: 0,
            forcedPassesLeft: 0,
            switchIns: new Set(),
            zMove: false,
            mega: false,
            ultra: false
        };
        // old-gens
        this.lastMove = null;
    }
    Side.prototype.toJSON = function () {
        return state_1.State.serializeSide(this);
    };
    Object.defineProperty(Side.prototype, "requestState", {
        get: function () {
            if (!this.activeRequest || this.activeRequest.wait)
                return '';
            if (this.activeRequest.teamPreview)
                return 'teampreview';
            if (this.activeRequest.forceSwitch)
                return 'switch';
            return 'move';
        },
        enumerable: true,
        configurable: true
    });
    Side.prototype.getChoice = function () {
        var _this = this;
        if (this.choice.actions.length > 1 && this.choice.actions.every(function (action) { return action.choice === 'team'; })) {
            return "team " + this.choice.actions.map(function (action) { return action.pokemon.position + 1; }).join(', ');
        }
        return this.choice.actions.map(function (action) {
            switch (action.choice) {
                case 'move':
                    var details = "";
                    if (action.targetLoc && _this.active.length > 1)
                        details += " " + action.targetLoc;
                    if (action.mega)
                        details += (action.pokemon.item === 'ultranecroziumz' ? " ultra" : " mega");
                    if (action.zmove)
                        details += " zmove";
                    return "move " + action.moveid + details;
                case 'switch':
                case 'instaswitch':
                    return "switch " + (action.target.position + 1);
                case 'team':
                    return "team " + (action.pokemon.position + 1);
                default:
                    return action.choice;
            }
        }).join(', ');
    };
    Side.prototype.toString = function () {
        return this.id + ": " + this.name;
    };
    Side.prototype.getRequestData = function () {
        var _this = this;
        var data = {
            name: this.name,
            id: this.id,
            pokemon: []
        };
        var _loop_1 = function (pokemon) {
            var entry = {
                ident: pokemon.fullname,
                details: pokemon.details,
                condition: pokemon.getHealth().secret,
                active: (pokemon.position < pokemon.side.active.length),
                stats: {
                    atk: pokemon.baseStoredStats['atk'],
                    def: pokemon.baseStoredStats['def'],
                    spa: pokemon.baseStoredStats['spa'],
                    spd: pokemon.baseStoredStats['spd'],
                    spe: pokemon.baseStoredStats['spe']
                },
                moves: pokemon.moves.map(function (move) {
                    if (move === 'hiddenpower') {
                        return move + toID(pokemon.hpType) + (_this.battle.gen < 6 ? '' : pokemon.hpPower);
                    }
                    if (move === 'frustration' || move === 'return') {
                        var m = _this.battle.dex.getMove(move);
                        // @ts-ignore - Frustration and Return only require the source Pokemon
                        var basePower = m.basePowerCallback(pokemon);
                        return "" + move + basePower;
                    }
                    return move;
                }),
                baseAbility: pokemon.baseAbility,
                item: pokemon.item,
                pokeball: pokemon.pokeball
            };
            if (this_1.battle.gen > 6)
                entry.ability = pokemon.ability;
            data.pokemon.push(entry);
        };
        var this_1 = this;
        for (var _i = 0, _a = this.pokemon; _i < _a.length; _i++) {
            var pokemon = _a[_i];
            _loop_1(pokemon);
        }
        return data;
    };
    Side.prototype.randomActive = function () {
        var actives = this.active.filter(function (active) { return active && !active.fainted; });
        if (!actives.length)
            return null;
        return this.battle.sample(actives);
    };
    Side.prototype.addSideCondition = function (status, source, sourceEffect) {
        if (source === void 0) { source = null; }
        if (sourceEffect === void 0) { sourceEffect = null; }
        if (this.n >= 2 && this.battle.gameType === 'multi') {
            return this.battle.sides[this.n % 2].addSideCondition(status, source, sourceEffect);
        }
        if (!source && this.battle.event && this.battle.event.target)
            source = this.battle.event.target;
        if (source === 'debug')
            source = this.active[0];
        if (!source)
            throw new Error("setting sidecond without a source");
        status = this.battle.dex.getEffect(status);
        if (this.sideConditions[status.id]) {
            if (!status.onRestart)
                return false;
            return this.battle.singleEvent('Restart', status, this.sideConditions[status.id], this, source, sourceEffect);
        }
        this.sideConditions[status.id] = {
            id: status.id,
            target: this,
            source: source,
            sourcePosition: source.position,
            duration: status.duration
        };
        if (status.durationCallback) {
            this.sideConditions[status.id].duration =
                status.durationCallback.call(this.battle, this.active[0], source, sourceEffect);
        }
        if (!this.battle.singleEvent('Start', status, this.sideConditions[status.id], this, source, sourceEffect)) {
            delete this.sideConditions[status.id];
            return false;
        }
        return true;
    };
    Side.prototype.getSideCondition = function (status) {
        if (this.n >= 2 && this.battle.gameType === 'multi') {
            return this.battle.sides[this.n % 2].getSideCondition(status);
        }
        status = this.battle.dex.getEffect(status);
        if (!this.sideConditions[status.id])
            return null;
        return status;
    };
    Side.prototype.getSideConditionData = function (status) {
        if (this.n >= 2 && this.battle.gameType === 'multi') {
            return this.battle.sides[this.n % 2].getSideConditionData(status);
        }
        status = this.battle.dex.getEffect(status);
        return this.sideConditions[status.id] || null;
    };
    Side.prototype.removeSideCondition = function (status) {
        if (this.n >= 2 && this.battle.gameType === 'multi') {
            return this.battle.sides[this.n % 2].removeSideCondition(status);
        }
        status = this.battle.dex.getEffect(status);
        if (!this.sideConditions[status.id])
            return false;
        this.battle.singleEvent('End', status, this.sideConditions[status.id], this);
        delete this.sideConditions[status.id];
        return true;
    };
    Side.prototype.addSlotCondition = function (target, status, source, sourceEffect) {
        if (source === void 0) { source = null; }
        if (sourceEffect === void 0) { sourceEffect = null; }
        if (!source && this.battle.event && this.battle.event.target)
            source = this.battle.event.target;
        if (source === 'debug')
            source = this.active[0];
        if (target instanceof pokemon_1.Pokemon)
            target = target.position;
        if (!source)
            throw new Error("setting sidecond without a source");
        status = this.battle.dex.getEffect(status);
        if (this.slotConditions[target][status.id]) {
            if (!status.onRestart)
                return false;
            return this.battle.singleEvent('Restart', status, this.slotConditions[target][status.id], this, source, sourceEffect);
        }
        var slotConditionData = this.slotConditions[target][status.id] = {
            id: status.id,
            target: this,
            source: source,
            sourcePosition: source.position,
            duration: status.duration
        };
        if (status.durationCallback) {
            slotConditionData.duration =
                status.durationCallback.call(this.battle, this.active[0], source, sourceEffect);
        }
        if (!this.battle.singleEvent('Start', status, slotConditionData, this.active[target], source, sourceEffect)) {
            delete this.slotConditions[target][status.id];
            return false;
        }
        return true;
    };
    Side.prototype.getSlotCondition = function (target, status) {
        if (target instanceof pokemon_1.Pokemon)
            target = target.position;
        status = this.battle.dex.getEffect(status);
        if (!this.slotConditions[target][status.id])
            return null;
        return status;
    };
    Side.prototype.removeSlotCondition = function (target, status) {
        if (target instanceof pokemon_1.Pokemon)
            target = target.position;
        status = this.battle.dex.getEffect(status);
        if (!this.slotConditions[target][status.id])
            return false;
        this.battle.singleEvent('End', status, this.slotConditions[target][status.id], this.active[target]);
        delete this.slotConditions[target][status.id];
        return true;
    };
    // tslint:disable-next-line:ban-types
    Side.prototype.send = function () {
        var _this = this;
        var parts = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            parts[_i] = arguments[_i];
        }
        var sideUpdate = '|' + parts.map(function (part) {
            if (typeof part !== 'function')
                return part;
            return part(_this);
        }).join('|');
        this.battle.send('sideupdate', this.id + "\n" + sideUpdate);
    };
    Side.prototype.emitRequest = function (update) {
        this.battle.send('sideupdate', this.id + "\n|request|" + JSON.stringify(update));
        this.activeRequest = update;
    };
    Side.prototype.emitChoiceError = function (message, unavailable) {
        this.choice.error = message;
        var type = "[" + (unavailable ? 'Unavailable' : 'Invalid') + " choice]";
        this.battle.send('sideupdate', this.id + "\n|error|" + type + " " + message);
        if (this.battle.strictChoices)
            throw new Error(type + " " + message);
        return false;
    };
    Side.prototype.isChoiceDone = function () {
        if (!this.requestState)
            return true;
        if (this.choice.forcedSwitchesLeft)
            return false;
        if (this.requestState === 'teampreview') {
            return this.choice.actions.length >= Math.min(this.maxTeamSize, this.pokemon.length);
        }
        // current request is move/switch
        this.getChoiceIndex(); // auto-pass
        return this.choice.actions.length >= this.active.length;
    };
    Side.prototype.chooseMove = function (moveText, targetLoc, megaOrZ) {
        if (this.requestState !== 'move') {
            return this.emitChoiceError("Can't move: You need a " + this.requestState + " response");
        }
        var index = this.getChoiceIndex();
        if (index >= this.active.length) {
            return this.emitChoiceError("Can't move: You sent more choices than unfainted Pok\u00E9mon.");
        }
        var autoChoose = !moveText;
        var pokemon = this.active[index];
        if (megaOrZ === true)
            megaOrZ = 'mega';
        if (!targetLoc)
            targetLoc = 0;
        // Parse moveText (name or index)
        // If the move is not found, the action is invalid without requiring further inspection.
        var requestMoves = pokemon.getRequestData().moves;
        var moveid = '';
        var targetType = '';
        if (autoChoose)
            moveText = 1;
        if (typeof moveText === 'number' || (moveText && /^[0-9]+$/.test(moveText))) {
            // Parse a one-based move index.
            var moveIndex = +moveText - 1;
            if (moveIndex < 0 || moveIndex >= requestMoves.length || !requestMoves[moveIndex]) {
                return this.emitChoiceError("Can't move: Your " + pokemon.name + " doesn't have a move " + (moveIndex + 1));
            }
            moveid = requestMoves[moveIndex].id;
            targetType = requestMoves[moveIndex].target;
        }
        else {
            // Parse a move ID.
            // Move names are also allowed, but may cause ambiguity (see client issue #167).
            moveid = toID(moveText);
            if (moveid.startsWith('hiddenpower')) {
                moveid = 'hiddenpower';
            }
            for (var _i = 0, requestMoves_1 = requestMoves; _i < requestMoves_1.length; _i++) {
                var move_1 = requestMoves_1[_i];
                if (move_1.id !== moveid)
                    continue;
                targetType = move_1.target || 'normal';
                break;
            }
            if (!targetType) {
                return this.emitChoiceError("Can't move: Your " + pokemon.name + " doesn't have a move matching " + moveid);
            }
        }
        var moves = pokemon.getMoves();
        if (autoChoose) {
            for (var _a = 0, _b = requestMoves.entries(); _a < _b.length; _a++) {
                var _c = _b[_a], i = _c[0], move_2 = _c[1];
                if (move_2.disabled)
                    continue;
                if (i < moves.length && move_2.id === moves[i].id && moves[i].disabled)
                    continue;
                moveid = move_2.id;
                targetType = move_2.target;
                break;
            }
        }
        var move = this.battle.dex.getMove(moveid);
        // Z-move
        var zMove = megaOrZ === 'zmove' ? this.battle.getZMove(move, pokemon) : undefined;
        if (megaOrZ === 'zmove' && !zMove) {
            return this.emitChoiceError("Can't move: " + pokemon.name + " can't use " + move.name + " as a Z-move");
        }
        if (zMove && this.choice.zMove) {
            return this.emitChoiceError("Can't move: You can't Z-move more than once per battle");
        }
        if (zMove)
            targetType = this.battle.dex.getMove(zMove).target;
        // Validate targetting
        if (autoChoose) {
            targetLoc = 0;
        }
        else if (this.battle.targetTypeChoices(targetType)) {
            if (!targetLoc && this.active.length >= 2) {
                return this.emitChoiceError("Can't move: " + move.name + " needs a target");
            }
            if (!this.battle.validTargetLoc(targetLoc, pokemon, targetType)) {
                return this.emitChoiceError("Can't move: Invalid target for " + move.name);
            }
        }
        else {
            if (targetLoc) {
                return this.emitChoiceError("Can't move: You can't choose a target for " + move.name);
            }
        }
        var lockedMove = pokemon.getLockedMove();
        if (lockedMove) {
            var lockedMoveTarget = pokemon.lastMoveTargetLoc;
            this.choice.actions.push({
                choice: 'move',
                pokemon: pokemon,
                targetLoc: lockedMoveTarget || 0,
                moveid: toID(lockedMove)
            });
            return true;
        }
        else if (!moves.length && !zMove) {
            // Override action and use Struggle if there are no enabled moves with PP
            // Gen 4 and earlier announce a Pokemon has no moves left before the turn begins, and only to that player's side.
            if (this.battle.gen <= 4)
                this.send('-activate', pokemon, 'move: Struggle');
            moveid = 'struggle';
        }
        else if (!zMove) {
            // Check for disabled moves
            var isEnabled = false;
            var disabledSource_1 = '';
            for (var _d = 0, moves_1 = moves; _d < moves_1.length; _d++) {
                var m = moves_1[_d];
                if (m.id !== moveid)
                    continue;
                if (!m.disabled) {
                    isEnabled = true;
                    break;
                }
                else if (m.disabledSource) {
                    disabledSource_1 = m.disabledSource;
                }
            }
            if (!isEnabled) {
                // Request a different choice
                if (autoChoose)
                    throw new Error("autoChoose chose a disabled move");
                var includeRequest = this.updateRequestForPokemon(pokemon, function (req) {
                    var updated = false;
                    for (var _i = 0, _a = req.moves; _i < _a.length; _i++) {
                        var m = _a[_i];
                        if (m.id === moveid) {
                            if (!m.disabled) {
                                m.disabled = true;
                                updated = true;
                            }
                            if (m.disabledSource !== disabledSource_1) {
                                m.disabledSource = disabledSource_1;
                                updated = true;
                            }
                            break;
                        }
                    }
                    return updated;
                });
                var status_1 = this.emitChoiceError("Can't move: " + pokemon.name + "'s " + move.name + " is disabled", includeRequest);
                if (includeRequest)
                    this.emitRequest(this.activeRequest);
                return status_1;
            }
            // The chosen move is valid yay
        }
        // Mega evolution
        var mega = (megaOrZ === 'mega');
        if (mega && !pokemon.canMegaEvo) {
            return this.emitChoiceError("Can't move: " + pokemon.name + " can't mega evolve");
        }
        if (mega && this.choice.mega) {
            return this.emitChoiceError("Can't move: You can only mega-evolve once per battle");
        }
        var ultra = (megaOrZ === 'ultra');
        if (ultra && !pokemon.canUltraBurst) {
            return this.emitChoiceError("Can't move: " + pokemon.name + " can't mega evolve");
        }
        if (ultra && this.choice.ultra) {
            return this.emitChoiceError("Can't move: You can only ultra burst once per battle");
        }
        this.choice.actions.push({
            choice: 'move',
            pokemon: pokemon,
            targetLoc: targetLoc,
            moveid: moveid,
            mega: mega || ultra,
            zmove: zMove
        });
        if (pokemon.maybeDisabled) {
            this.choice.cantUndo = this.choice.cantUndo || pokemon.isLastActive();
        }
        if (mega)
            this.choice.mega = true;
        if (ultra)
            this.choice.ultra = true;
        if (zMove)
            this.choice.zMove = true;
        return true;
    };
    Side.prototype.updateRequestForPokemon = function (pokemon, update) {
        if (!this.activeRequest || !this.activeRequest.active) {
            throw new Error("Can't update a request without active Pokemon");
        }
        var req = this.activeRequest.active[pokemon.position];
        if (!req)
            throw new Error("Pokemon not found in request's active field");
        return update(req);
    };
    Side.prototype.chooseSwitch = function (slotText) {
        if (this.requestState !== 'move' && this.requestState !== 'switch') {
            return this.emitChoiceError("Can't switch: You need a " + this.requestState + " response");
        }
        var index = this.getChoiceIndex();
        if (index >= this.active.length) {
            if (this.requestState === 'switch') {
                return this.emitChoiceError("Can't switch: You sent more switches than Pok\u00E9mon that need to switch");
            }
            return this.emitChoiceError("Can't switch: You sent more choices than unfainted Pok\u00E9mon");
        }
        var pokemon = this.active[index];
        var autoChoose = !slotText;
        var slot;
        if (autoChoose) {
            if (this.requestState !== 'switch') {
                return this.emitChoiceError("Can't switch: You need to select a Pok\u00E9mon to switch in");
            }
            if (!this.choice.forcedSwitchesLeft)
                return this.choosePass();
            slot = this.active.length;
            while (this.choice.switchIns.has(slot) || this.pokemon[slot].fainted)
                slot++;
        }
        else {
            slot = parseInt(slotText, 10) - 1;
        }
        if (isNaN(slot) || slot < 0) {
            // maybe it's a name/species id!
            slot = -1;
            for (var _i = 0, _a = this.pokemon.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], i = _b[0], mon = _b[1];
                if (slotText.toLowerCase() === mon.name.toLowerCase() || toID(slotText) === mon.speciesid) {
                    slot = i;
                    break;
                }
            }
            if (slot < 0) {
                return this.emitChoiceError("Can't switch: You do not have a Pok\u00E9mon named \"" + slotText + "\" to switch to");
            }
        }
        if (slot >= this.pokemon.length) {
            return this.emitChoiceError("Can't switch: You do not have a Pok\u00E9mon in slot " + (slot + 1) + " to switch to");
        }
        else if (slot < this.active.length) {
            return this.emitChoiceError("Can't switch: You can't switch to an active Pok\u00E9mon");
        }
        else if (this.choice.switchIns.has(slot)) {
            return this.emitChoiceError("Can't switch: The Pok\u00E9mon in slot " + (slot + 1) + " can only switch in once");
        }
        var targetPokemon = this.pokemon[slot];
        if (targetPokemon.fainted) {
            return this.emitChoiceError("Can't switch: You can't switch to a fainted Pok\u00E9mon");
        }
        if (this.requestState === 'move') {
            if (pokemon.trapped) {
                var includeRequest = this.updateRequestForPokemon(pokemon, function (req) {
                    var updated = false;
                    if (req.maybeTrapped) {
                        delete req.maybeTrapped;
                        updated = true;
                    }
                    if (!req.trapped) {
                        req.trapped = true;
                        updated = true;
                    }
                    return updated;
                });
                var status_2 = this.emitChoiceError("Can't switch: The active Pok\u00E9mon is trapped", includeRequest);
                if (includeRequest)
                    this.emitRequest(this.activeRequest);
                return status_2;
            }
            else if (pokemon.maybeTrapped) {
                this.choice.cantUndo = this.choice.cantUndo || pokemon.isLastActive();
            }
        }
        else if (this.requestState === 'switch') {
            if (!this.choice.forcedSwitchesLeft) {
                throw new Error("Player somehow switched too many Pokemon");
            }
            this.choice.forcedSwitchesLeft--;
        }
        this.choice.switchIns.add(slot);
        // tslint:disable-next-line:no-object-literal-type-assertion
        this.choice.actions.push({
            choice: (this.requestState === 'switch' ? 'instaswitch' : 'switch'),
            pokemon: pokemon,
            target: targetPokemon
        });
        return true;
    };
    Side.prototype.chooseTeam = function (data) {
        var autoFill = !data;
        // default to sending team in order
        if (!data)
            data = "123456";
        var positions = (('' + data)
            .split(data.includes(',') ? ',' : '')
            .map(function (datum) { return parseInt(datum, 10) - 1; }));
        if (autoFill && this.choice.actions.length >= this.maxTeamSize)
            return true;
        if (this.requestState !== 'teampreview') {
            return this.emitChoiceError("Can't choose for Team Preview: You're not in a Team Preview phase");
        }
        // hack for >6 pokemon Custom Game
        while (positions.length >= 6 && positions.length < this.maxTeamSize && positions.length < this.pokemon.length) {
            positions.push(positions.length);
        }
        for (var _i = 0, positions_1 = positions; _i < positions_1.length; _i++) {
            var pos = positions_1[_i];
            var index = this.choice.actions.length;
            if (index >= this.maxTeamSize || index >= this.pokemon.length) {
                // client still sends entire team
                break;
                // if (autoFill) break;
                // return this.emitChoiceError(`Can't choose for Team Preview: You are limited to ${this.maxTeamSize} Pokémon`);
            }
            if (isNaN(pos) || pos < 0 || pos >= this.pokemon.length) {
                return this.emitChoiceError("Can't choose for Team Preview: You do not have a Pok\u00E9mon in slot " + (pos + 1));
            }
            if (this.choice.switchIns.has(pos)) {
                if (autoFill)
                    continue;
                return this.emitChoiceError("Can't choose for Team Preview: The Pok\u00E9mon in slot " + (pos + 1) + " can only switch in once");
            }
            this.choice.switchIns.add(pos);
            // tslint:disable-next-line:no-object-literal-type-assertion
            this.choice.actions.push({
                choice: 'team',
                index: index,
                pokemon: this.pokemon[pos],
                priority: -index
            });
        }
        return true;
    };
    Side.prototype.chooseShift = function () {
        var index = this.getChoiceIndex();
        if (index >= this.active.length) {
            return this.emitChoiceError("Can't shift: You do not have a Pok\u00E9mon in slot " + (index + 1));
        }
        else if (this.requestState !== 'move') {
            return this.emitChoiceError("Can't shift: You can only shift during a move phase");
        }
        else if (this.battle.gameType !== 'triples') {
            return this.emitChoiceError("Can't shift: You can only shift to the center in triples");
        }
        else if (index === 1) {
            return this.emitChoiceError("Can't shift: You can only shift from the edge to the center");
        }
        var pokemon = this.active[index];
        // tslint:disable-next-line:no-object-literal-type-assertion
        this.choice.actions.push({
            choice: 'shift',
            pokemon: pokemon
        });
        return true;
    };
    Side.prototype.clearChoice = function () {
        var forcedSwitches = 0;
        var forcedPasses = 0;
        if (this.battle.requestState === 'switch') {
            var canSwitchOut = this.active.filter(function (pokemon) { return pokemon && pokemon.switchFlag; }).length;
            var canSwitchIn = this.pokemon.slice(this.active.length).filter(function (pokemon) { return pokemon && !pokemon.fainted; }).length;
            forcedSwitches = Math.min(canSwitchOut, canSwitchIn);
            forcedPasses = canSwitchOut - forcedSwitches;
        }
        this.choice = {
            cantUndo: false,
            error: "",
            actions: [],
            forcedSwitchesLeft: forcedSwitches,
            forcedPassesLeft: forcedPasses,
            switchIns: new Set(),
            zMove: false,
            mega: false,
            ultra: false
        };
    };
    Side.prototype.choose = function (input) {
        var _this = this;
        if (!this.requestState) {
            return this.emitChoiceError(this.battle.ended ? "Can't do anything: The game is over" : "Can't do anything: It's not your turn");
        }
        if (this.choice.cantUndo) {
            return this.emitChoiceError("Can't undo: A trapping/disabling effect would cause undo to leak information");
        }
        this.clearChoice();
        var choiceStrings = (input.startsWith('team ') ? [input] : input.split(','));
        if (choiceStrings.length > this.active.length) {
            return this.emitChoiceError("Can't make choices: You sent choices for " + choiceStrings.length + " Pok\u00E9mon, but this is a " + this.battle.gameType + " game!");
        }
        var _loop_2 = function (choiceString) {
            var choiceType = '';
            var data = '';
            choiceString = choiceString.trim();
            var firstSpaceIndex = choiceString.indexOf(' ');
            if (firstSpaceIndex >= 0) {
                data = choiceString.slice(firstSpaceIndex + 1).trim();
                choiceType = choiceString.slice(0, firstSpaceIndex);
            }
            else {
                choiceType = choiceString;
            }
            switch (choiceType) {
                case 'move':
                    var original_1 = data;
                    var error = function () { return _this.emitChoiceError("Conflicting arguments for \"move\": " + original_1); };
                    var targetLoc = void 0;
                    var megaOrZ = '';
                    while (true) {
                        // If data ends with a number, treat it as a target location.
                        // We need to special case 'Conversion 2' so it doesn't get
                        // confused with 'Conversion' erroneously sent with the target
                        // '2' (since Conversion targets 'self', targetLoc can't be 2).
                        if (/\s(?:-|\+)?[1-3]$/.test(data) && toID(data) !== 'conversion2') {
                            if (targetLoc !== undefined)
                                return { value: error() };
                            targetLoc = parseInt(data.slice(-2), 10);
                            data = data.slice(0, -2).trim();
                        }
                        else if (data.endsWith(' mega')) {
                            if (megaOrZ)
                                return { value: error() };
                            megaOrZ = 'mega';
                            data = data.slice(0, -5);
                        }
                        else if (data.endsWith(' zmove')) {
                            if (megaOrZ)
                                return { value: error() };
                            megaOrZ = 'zmove';
                            data = data.slice(0, -6);
                        }
                        else if (data.endsWith(' ultra')) {
                            if (megaOrZ)
                                return { value: error() };
                            megaOrZ = 'ultra';
                            data = data.slice(0, -6);
                        }
                        else {
                            break;
                        }
                    }
                    if (!this_2.chooseMove(data, targetLoc, megaOrZ))
                        return { value: false };
                    break;
                case 'switch':
                    this_2.chooseSwitch(data);
                    break;
                case 'shift':
                    if (data)
                        return { value: this_2.emitChoiceError("Unrecognized data after \"shift\": " + data) };
                    if (!this_2.chooseShift())
                        return { value: false };
                    break;
                case 'team':
                    if (!this_2.chooseTeam(data))
                        return { value: false };
                    // Auto-complete
                    this_2.chooseTeam();
                    break;
                case 'pass':
                case 'skip':
                    if (data)
                        return { value: this_2.emitChoiceError("Unrecognized data after \"pass\": " + data) };
                    if (!this_2.choosePass())
                        return { value: false };
                    break;
                case 'auto':
                case 'default':
                    this_2.autoChoose();
                    break;
                default:
                    this_2.emitChoiceError("Unrecognized choice: " + choiceString);
                    break;
            }
        };
        var this_2 = this;
        for (var _i = 0, choiceStrings_1 = choiceStrings; _i < choiceStrings_1.length; _i++) {
            var choiceString = choiceStrings_1[_i];
            var state_2 = _loop_2(choiceString);
            if (typeof state_2 === "object")
                return state_2.value;
        }
        return !this.choice.error;
    };
    Side.prototype.getChoiceIndex = function (isPass) {
        var index = this.choice.actions.length;
        if (!isPass) {
            switch (this.requestState) {
                case 'move':
                    // auto-pass
                    while (index < this.active.length && this.active[index].fainted) {
                        this.choosePass();
                        index++;
                    }
                    break;
                case 'switch':
                    while (index < this.active.length && !this.active[index].switchFlag) {
                        this.choosePass();
                        index++;
                    }
                    break;
            }
        }
        return index;
    };
    Side.prototype.choosePass = function () {
        var index = this.getChoiceIndex(true);
        if (index >= this.active.length)
            return false;
        var pokemon = this.active[index];
        switch (this.requestState) {
            case 'switch':
                if (pokemon.switchFlag) { // This condition will always happen if called by Battle#choose()
                    if (!this.choice.forcedPassesLeft) {
                        return this.emitChoiceError("Can't pass: You need to switch in a Pok\u00E9mon to replace " + pokemon.name);
                    }
                    this.choice.forcedPassesLeft--;
                }
                break;
            case 'move':
                if (!pokemon.fainted) {
                    return this.emitChoiceError("Can't pass: Your " + pokemon.name + " must make a move (or switch)");
                }
                break;
            default:
                return this.emitChoiceError("Can't pass: Not a move or switch request");
        }
        // tslint:disable-next-line:no-object-literal-type-assertion
        this.choice.actions.push({
            choice: 'pass'
        });
        return true;
    };
    /** Automatically finish a choice if not currently complete. */
    Side.prototype.autoChoose = function () {
        if (this.requestState === 'teampreview') {
            if (!this.isChoiceDone())
                this.chooseTeam();
        }
        else if (this.requestState === 'switch') {
            while (!this.isChoiceDone())
                this.chooseSwitch();
        }
        else if (this.requestState === 'move') {
            while (!this.isChoiceDone())
                this.chooseMove();
        }
        return true;
    };
    Side.prototype.destroy = function () {
        // deallocate ourself
        // deallocate children and get rid of references to them
        for (var _i = 0, _a = this.pokemon; _i < _a.length; _i++) {
            var pokemon = _a[_i];
            if (pokemon)
                pokemon.destroy();
        }
        for (var _b = 0, _c = this.choice.actions; _b < _c.length; _b++) {
            var action = _c[_b];
            delete action.side;
            delete action.pokemon;
            delete action.target;
        }
        this.choice.actions = [];
        // get rid of some possibly-circular references
        this.pokemon = [];
        this.active = [];
        // @ts-ignore - readonly
        this.battle = null;
        this.foe = null;
    };
    return Side;
}());
exports.Side = Side;
