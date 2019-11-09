"use strict";Object.defineProperty(exports, "__esModule", {value: true}); var _class;/**
 * Chat
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * This handles chat and chat commands sent from users to chatrooms
 * and PMs. The main function you're looking for is Chat.parse
 * (scroll down to its definition for details)
 *
 * Individual commands are put in:
 *   chat-commands.js - "core" commands that shouldn't be modified
 *   chat-plugins/ - other commands that can be safely modified
 *
 * The command API is (mostly) documented in chat-plugins/COMMANDS.md
 *
 * @license MIT
 */

/*

To reload chat commands:

/hotpatch chat

*/

'use strict';









































const LINK_WHITELIST = [
	'*.pokemonshowdown.com', 'psim.us', 'smogtours.psim.us',
	'*.smogon.com', '*.pastebin.com', '*.hastebin.com',
];

const MAX_MESSAGE_LENGTH = 300;

const BROADCAST_COOLDOWN = 20 * 1000;
const MESSAGE_COOLDOWN = 5 * 60 * 1000;

const MAX_PARSE_RECURSION = 10;

const VALID_COMMAND_TOKENS = '/!';
const BROADCAST_TOKEN = '!';

const TRANSLATION_DIRECTORY = 'translations/';

var _fs = require('../.lib-dist/fs');
var _chatformatter = require('./chat-formatter');

// @ts-ignore no typedef available
const ProbeModule = require('probe-image-size');
const probe = ProbeModule;

const emojiRegex = /[\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\uFE0F]/u;

class PatternTester {
	// This class sounds like a RegExp
	// In fact, one could in theory implement it as a RegExp subclass
	// However, ES2016 RegExp subclassing is a can of worms, and it wouldn't allow us
	// to tailor the test method for fast command parsing.
	
	
	
	constructor() {
		this.elements = [];
		this.fastElements = new Set();
		this.regexp = null;
	}
	fastNormalize(elem) {
		return elem.slice(0, -1);
	}
	update() {
		const slowElements = this.elements.filter(elem => !this.fastElements.has(this.fastNormalize(elem)));
		if (slowElements.length) {
			this.regexp = new RegExp('^(' + slowElements.map(elem => '(?:' + elem + ')').join('|') + ')', 'i');
		}
	}
	register(...elems) {
		for (const elem of elems) {
			this.elements.push(elem);
			if (/^[^ ^$?|()[\]]+ $/.test(elem)) {
				this.fastElements.add(this.fastNormalize(elem));
			}
		}
		this.update();
	}
	testCommand(text) {
		const spaceIndex = text.indexOf(' ');
		if (this.fastElements.has(spaceIndex >= 0 ? text.slice(0, spaceIndex) : text)) {
			return true;
		}
		if (!this.regexp) return false;
		return this.regexp.test(text);
	}
	test(text) {
		if (!text.includes('\n')) return null;
		if (this.testCommand(text)) return text;
		// The PM matching is a huge mess, and really needs to be replaced with
		// the new multiline command system soon.
		const pmMatches = /^(\/(?:pm|w|whisper|msg) [^,]*, ?)(.*)/i.exec(text);
		if (pmMatches && this.testCommand(pmMatches[2])) {
			if (text.split('\n').every(line => line.startsWith(pmMatches[1]))) {
				return text.replace(/\n\/(?:pm|w|whisper|msg) [^,]*, ?/g, '\n');
			}
			return text;
		}
		return null;
	}
}

/*********************************************************
 * Parser
 *********************************************************/

// These classes need to be declared here because they aren't hoisted
class MessageContext {
	
	
	
	constructor(user, language = null) {
		this.recursionDepth = 0;

		this.user = user;
		this.language = language;
	}

	splitOne(target) {
		const commaIndex = target.indexOf(',');
		if (commaIndex < 0) {
			return [target.trim(), ''];
		}
		return [target.slice(0, commaIndex).trim(), target.slice(commaIndex + 1).trim()];
	}
	meansYes(text) {
		switch (text.toLowerCase().trim()) {
		case 'on': case 'enable': case 'yes': case 'true':
			return true;
		}
		return false;
	}
	meansNo(text) {
		switch (text.toLowerCase().trim()) {
		case 'off': case 'disable': case 'no': case 'false':
			return true;
		}
		return false;
	}

	tr(strings, ...keys) {
		return exports.Chat.tr(this.language, strings, ...keys);
	}
}

 class PageContext extends MessageContext {
	
	
	
	
	
	constructor(options) {
		super(options.user, options.language);

		this.connection = options.connection;
		this.room = Rooms.get('global');
		this.pageid = options.pageid;

		this.initialized = false;
		this.title = 'Page';
	}

	can(permission, target = null, room = null) {
		if (!this.user.can(permission, target, room)) {
			this.send(`<h2>Permission denied.</h2>`);
			return false;
		}
		return true;
	}

	extractRoom(pageid) {
		if (!pageid) pageid = this.pageid;
		const parts = pageid.split('-');

		// Since we assume pageids are all in the form of view-pagename-roomid
		// if someone is calling this function, so this is the only case we cover (for now)
		const room = Rooms.get(parts[2]);
		if (!room) {
			this.send(`<h2>Invalid room.</h2>`);
			return false;
		}

		this.room = room;
		return room.roomid;
	}

	send(content) {
		if (!content.startsWith('|deinit')) {
			const roomid = this.room !== Rooms.global ? `[${this.room.roomid}] ` : '';
			if (!this.initialized) {
				content = `|init|html\n|title|${roomid}${this.title}\n|pagehtml|${content}`;
				this.initialized = true;
			} else {
				content = `|title|${roomid}${this.title}\n|pagehtml|${content}`;
			}
		}
		this.connection.send(`>${this.pageid}\n${content}`);
	}

	close() {
		this.send('|deinit');
	}

	async resolve(pageid) {
		if (pageid) this.pageid = pageid;

		const parts = this.pageid.split('-');
		let handler = exports.Chat.pages;
		parts.shift();
		while (handler) {
			if (typeof handler === 'function') {
				let res = await handler.bind(this)(parts, this.user, this.connection);
				if (typeof res === 'string') {
					this.send(res);
					res = undefined;
				}
				return res;
			}
			handler = handler[parts.shift() || 'default'];
		}
	}
} exports.PageContext = PageContext;

 class CommandContext extends MessageContext {

	
	
	
	
	
	
	
	
	
	
	
	
	
	
	constructor(
		options


	) {
		super(options.user, options.room && options.room.language ? options.room.language : options.user.language);

		this.message = options.message || ``;

		// message context
		this.pmTarget = options.pmTarget;
		this.room = options.room;
		this.connection = options.connection;

		// command context
		this.cmd = options.cmd || '';
		this.cmdToken = options.cmdToken || '';
		this.target = options.target || ``;
		this.fullCmd = options.fullCmd || '';

		// broadcast context
		this.broadcasting = false;
		this.broadcastToRoom = true;
		this.broadcastMessage = '';

		// target user
		this.targetUser = null;
		this.targetUsername = "";
		this.inputUsername = "";
	}

	parse(msg) {
		if (typeof msg === 'string') {
			// spawn subcontext
			const subcontext = new CommandContext(this);
			subcontext.recursionDepth++;
			if (subcontext.recursionDepth > MAX_PARSE_RECURSION) {
				throw new Error("Too much command recursion");
			}
			subcontext.message = msg;
			return subcontext.parse();
		}
		let message = this.message;

		const commandHandler = this.splitCommand(message);

		if (this.user.statusType === 'idle') this.user.setStatusType('online');

		if (typeof commandHandler === 'function') {
			message = this.run(commandHandler);
		} else {
			if (commandHandler === '!') {
				if (this.room === Rooms.global) {
					return this.popupReply(`You tried use "${message}" as a global command, but it is not a global command.`);
				} else if (this.room) {
					return this.popupReply(`You tried to send "${message}" to the room "${this.room.roomid}" but it failed because you were not in that room.`);
				}
				return this.errorReply(`The command "${this.cmdToken}${this.fullCmd}" is unavailable in private messages. To send a message starting with "${this.cmdToken}${this.fullCmd}", type "${this.cmdToken}${this.cmdToken}${this.fullCmd}".`);
			}
			if (this.cmdToken) {
				// To guard against command typos, show an error message
				if (this.cmdToken === BROADCAST_TOKEN) {
					if (/[a-z0-9]/.test(this.cmd.charAt(0))) {
						return this.errorReply(`The command "${this.cmdToken}${this.fullCmd}" does not exist.`);
					}
				} else {
					return this.errorReply(`The command "${this.cmdToken}${this.fullCmd}" does not exist. To send a message starting with "${this.cmdToken}${this.fullCmd}", type "${this.cmdToken}${this.cmdToken}${this.fullCmd}".`);
				}
			} else if (!VALID_COMMAND_TOKENS.includes(message.charAt(0)) &&
					VALID_COMMAND_TOKENS.includes(message.trim().charAt(0))) {
				message = message.trim();
				if (message.charAt(0) !== BROADCAST_TOKEN) {
					message = message.charAt(0) + message;
				}
			}

			message = this.canTalk(message);
		}

		// Output the message

		if (message && message !== true && typeof message.then !== 'function') {
			if (this.pmTarget) {
				exports.Chat.sendPM(message, this.user, this.pmTarget);
			} else {
				this.room.add(`|c|${this.user.getIdentity(this.room.roomid)}|${message}`);
				if (this.room && this.room.game && this.room.game.onLogMessage) {
					this.room.game.onLogMessage(message, this.user);
				}
			}
		}

		this.update();

		return message;
	}

	splitCommand(message = this.message, recursing = false) {
		this.cmd = '';
		this.cmdToken = '';
		this.target = '';
		if (!message || !message.trim().length) return;

		// hardcoded commands
		if (message.startsWith(`>> `)) {
			message = `/eval ${message.slice(3)}`;
		} else if (message.startsWith(`>>> `)) {
			message = `/evalbattle ${message.slice(4)}`;
		} else if (message.startsWith(`/me`) && /[^A-Za-z0-9 ]/.test(message.charAt(3))) {
			message = `/mee ${message.slice(3)}`;
		} else if (message.startsWith(`/ME`) && /[^A-Za-z0-9 ]/.test(message.charAt(3))) {
			message = `/MEE ${message.slice(3)}`;
		}

		const cmdToken = message.charAt(0);
		if (!VALID_COMMAND_TOKENS.includes(cmdToken)) return;
		if (cmdToken === message.charAt(1)) return;
		if (cmdToken === BROADCAST_TOKEN && /[^A-Za-z0-9]/.test(message.charAt(1))) return;

		let cmd = '';
		let target = '';

		const messageSpaceIndex = message.indexOf(' ');
		if (messageSpaceIndex > 0) {
			cmd = message.slice(1, messageSpaceIndex).toLowerCase();
			target = message.slice(messageSpaceIndex + 1).trim();
		} else {
			cmd = message.slice(1).toLowerCase();
			target = '';
		}

		if (cmd.endsWith(',')) cmd = cmd.slice(0, -1);

		let curCommands = exports.Chat.commands;
		let commandHandler;
		let fullCmd = cmd;

		do {
			if (curCommands.hasOwnProperty(cmd)) {
				commandHandler = curCommands[cmd];
			} else {
				commandHandler = undefined;
			}
			if (typeof commandHandler === 'string') {
				// in case someone messed up, don't loop
				commandHandler = curCommands[commandHandler];
			} else if (Array.isArray(commandHandler) && !recursing) {
				return this.splitCommand(cmdToken + 'help ' + fullCmd.slice(0, -4), true);
			}
			if (commandHandler && typeof commandHandler === 'object') {
				const spaceIndex = target.indexOf(' ');
				if (spaceIndex > 0) {
					cmd = target.substr(0, spaceIndex).toLowerCase();
					target = target.substr(spaceIndex + 1);
				} else {
					cmd = target.toLowerCase();
					target = '';
				}

				fullCmd += ' ' + cmd;
				curCommands = commandHandler ;
			}
		} while (commandHandler && typeof commandHandler === 'object');

		if (!commandHandler && curCommands.default) {
			commandHandler = curCommands.default;
			if (typeof commandHandler === 'string') {
				commandHandler = curCommands[commandHandler];
			}
		}

		if (!commandHandler && !recursing) {
			for (const g in Config.groups) {
				const groupid = Config.groups[g].id;
				if (fullCmd === groupid) {
					return this.splitCommand(`/promote ${target}, ${g}`, true);
				} else if (fullCmd === 'global' + groupid) {
					return this.splitCommand(`/globalpromote ${target}, ${g}`, true);
				} else if (fullCmd === 'de' + groupid || fullCmd === 'un' + groupid ||
						fullCmd === 'globalde' + groupid || fullCmd === 'deglobal' + groupid) {
					return this.splitCommand(`/demote ${target}`, true);
				} else if (fullCmd === 'room' + groupid) {
					return this.splitCommand(`/roompromote ${target}, ${g}`, true);
				} else if (fullCmd === 'forceroom' + groupid) {
					return this.splitCommand(`/roompromote !!!${target}, ${g}`, true);
				} else if (fullCmd === 'roomde' + groupid || fullCmd === 'deroom' + groupid || fullCmd === 'roomun' + groupid) {
					return this.splitCommand(`/roomdemote ${target}`, true);
				}
			}
		}

		this.cmd = cmd;
		this.cmdToken = cmdToken;
		this.target = target;
		this.fullCmd = fullCmd;

		const requireGlobalCommand = (
			this.pmTarget ||
			this.room === Rooms.global ||
			(this.room && !(this.user.id in this.room.users))
		);

		if (typeof commandHandler === 'function' && requireGlobalCommand) {
			const baseCmd = typeof curCommands[cmd] === 'string' ? curCommands[cmd] : cmd;
			if (!curCommands['!' + baseCmd]) {
				return '!';
			}
		}

		// @ts-ignore type narrowing handled above
		return commandHandler;
	}
	run(commandHandler) {
		// type checked above
		if (typeof commandHandler === 'string') commandHandler = exports.Chat.commands[commandHandler] ;
		let result;
		try {
			result = commandHandler.call(this, this.target, this.room, this.user, this.connection, this.cmd, this.message);
		} catch (err) {
			Monitor.crashlog(err, 'A chat command', {
				user: this.user.name,
				room: this.room && this.room.roomid,
				pmTarget: this.pmTarget && this.pmTarget.name,
				message: this.message,
			});
			this.sendReply(`|html|<div class="broadcast-red"><b>Pokemon Showdown crashed!</b><br />Don't worry, we're working on fixing it.</div>`);
		}
		if (result === undefined) result = false;

		return result;
	}

	checkFormat(room, user, message) {
		if (!room) return true;
		if (!room.filterStretching && !room.filterCaps && !room.filterEmojis) return true;
		if (user.can('bypassall')) return true;

		if (room.filterStretching && user.name.match(/(.+?)\1{5,}/i)) {
			return this.errorReply(`Your username contains too much stretching, which this room doesn't allow.`);
		}
		if (room.filterCaps && user.name.match(/[A-Z\s]{6,}/)) {
			return this.errorReply(`Your username contains too many capital letters, which this room doesn't allow.`);
		}
		if (room.filterEmojis && user.name.match(emojiRegex)) {
			return this.errorReply(`Your username contains emojis, which this room doesn't allow.`);
		}
		// Removes extra spaces and null characters
		message = message.trim().replace(/[ \u0000\u200B-\u200F]+/g, ' ');

		if (room.filterStretching && message.match(/(.+?)\1{7,}/i)) {
			return this.errorReply(`Your message contains too much stretching, which this room doesn't allow.`);
		}
		if (room.filterCaps && message.match(/[A-Z\s]{18,}/)) {
			return this.errorReply(`Your message contains too many capital letters, which this room doesn't allow.`);
		}
		if (room.filterEmojis && message.match(emojiRegex)) {
			return this.errorReply(`Your message contains emojis, which this room doesn't allow.`);
		}

		return true;
	}

	checkSlowchat(room, user) {
		if (!room || !room.slowchat) return true;
		if (user.can('broadcast', null, room)) return true;
		const lastActiveSeconds = (Date.now() - user.lastMessageTime) / 1000;
		if (lastActiveSeconds < room.slowchat) return false;
		return true;
	}

	checkBanwords(room, message) {
		if (!room) return true;
		if (!room.banwordRegex) {
			if (room.banwords && room.banwords.length) {
				room.banwordRegex = new RegExp('(?:\\b|(?!\\w))(?:' + room.banwords.join('|') + ')(?:\\b|\\B(?!\\w))', 'i');
			} else {
				room.banwordRegex = true;
			}
		}
		if (!message) return true;
		if (room.banwordRegex !== true && room.banwordRegex.test(message)) {
			return false;
		}
		return this.checkBanwords(room.parent , message);
	}
	checkGameFilter() {
		if (!this.room || !this.room.game || !this.room.game.onChatMessage) return false;
		return this.room.game.onChatMessage(this.message, this.user);
	}
	pmTransform(originalMessage) {
		if (!this.pmTarget && this.room !== Rooms.global) throw new Error(`Not a PM`);
		const targetIdentity = this.pmTarget ? this.pmTarget.getIdentity() : '~';
		const prefix = `|pm|${this.user.getIdentity()}|${targetIdentity}|`;
		return originalMessage.split('\n').map(message => {
			if (message.startsWith('||')) {
				return prefix + `/text ` + message.slice(2);
			} else if (message.startsWith(`|html|`)) {
				return prefix + `/raw ` + message.slice(6);
			} else if (message.startsWith(`|raw|`)) {
				return prefix + `/raw ` + message.slice(5);
			} else if (message.startsWith(`|error|`)) {
				return prefix + `/error ` + message.slice(7);
			} else if (message.startsWith(`|c~|`)) {
				return prefix + message.slice(4);
			} else if (message.startsWith(`|c|~|/`)) {
				return prefix + message.slice(5);
			}
			return prefix + `/text ` + message;
		}).join(`\n`);
	}
	sendReply(data) {
		if (this.broadcasting && this.broadcastToRoom) {
			// broadcasting
			this.add(data);
		} else {
			// not broadcasting
			if (this.pmTarget || this.room === Rooms.global) {
				data = this.pmTransform(data);
				this.connection.send(data);
			} else {
				this.connection.sendTo(this.room, data);
			}
		}
	}
	errorReply(message) {
		this.sendReply(`|error|` + message.replace(/\n/g, `\n|error|`));
	}
	addBox(htmlContent) {
		this.add(`|html|<div class="infobox">${htmlContent}</div>`);
	}
	sendReplyBox(htmlContent) {
		this.sendReply(`|html|<div class="infobox">${htmlContent}</div>`);
	}
	popupReply(message) {
		this.connection.popup(message);
	}
	add(data) {
		if (this.pmTarget) {
			data = this.pmTransform(data);
			this.user.send(data);
			if (this.pmTarget !== this.user) this.pmTarget.send(data);
			return;
		}
		this.room.add(data);
	}
	send(data) {
		if (this.pmTarget) {
			data = this.pmTransform(data);
			this.user.send(data);
			if (this.pmTarget !== this.user) this.pmTarget.send(data);
			return;
		}
		this.room.send(data);
	}
	sendModCommand(data) {
		this.room.sendModsByUser(this.user, data);
	}

	privateModCommand() {
		throw new Error(`this.privateModCommand has been renamed to this.privateModAction, which no longer writes to modlog.`);
	}
	privateModAction(msg) {
		this.room.sendMods(msg);
		this.roomlog(msg);
	}
	globalModlog(action, user, note) {
		let buf = `(${this.room.roomid}) ${action}: `;
		if (user) {
			if (typeof user === 'string') {
				buf += `[${user}]`;
			} else {
				const userid = user.getLastId();
				buf += `[${userid}]`;
				if (user.autoconfirmed && user.autoconfirmed !== userid) buf += ` ac:[${user.autoconfirmed}]`;
				const alts = user.getAltUsers(false, true).slice(1).map(alt => alt.getLastId()).join('], [');
				if (alts.length) buf += ` alts:[${alts}]`;
				buf += ` [${user.latestIp}]`;
			}
		}
		buf += note.replace(/\n/gm, ' ');

		Rooms.global.modlog(buf);
		if (this.room !== Rooms.global) this.room.modlog(buf);
	}
	modlog(
		action,
		user = null,
		note = null,
		options = {}
	) {
		let buf = `(${this.room.roomid}) ${action}: `;
		if (user) {
			if (typeof user === 'string') {
				buf += `[${toID(user)}]`;
			} else {
				const userid = user.getLastId();
				buf += `[${userid}]`;
				if (!options.noalts) {
					if (user.autoconfirmed && user.autoconfirmed !== userid) buf += ` ac:[${user.autoconfirmed}]`;
					const alts = user.getAltUsers(false, true).slice(1).map(alt => alt.getLastId()).join('], [');
					if (alts.length) buf += ` alts:[${alts}]`;
				}
				if (!options.noip) buf += ` [${user.latestIp}]`;
			}
		}
		buf += ` by ${this.user.id}`;
		if (note) buf += `: ${note.replace(/\n/gm, ' ')}`;

		this.room.modlog(buf);
	}
	roomlog(data) {
		if (this.pmTarget) return;
		this.room.roomlog(data);
	}
	logEntry() {
		throw new Error(`this.logEntry has been renamed to this.roomlog.`);
	}
	addModCommand() {
		throw new Error(`this.addModCommand has been renamed to this.addModAction, which no longer writes to modlog.`);
	}
	addModAction(msg) {
		this.room.addByUser(this.user, msg);
	}
	update() {
		if (this.room) this.room.update();
	}
	filter(message, targetUser = null) {
		if (!this.room || this.room.roomid === 'global') return null;
		return exports.Chat.filter(this, message, this.user, this.room , this.connection, targetUser);
	}
	statusfilter(status) {
		return exports.Chat.statusfilter(status, this.user);
	}
	can(permission, target = null, room = null) {
		if (!this.user.can(permission, target, room)) {
			this.errorReply(this.cmdToken + this.fullCmd + " - Access denied.");
			return false;
		}
		return true;
	}
	canBroadcast(ignoreCooldown, suppressMessage) {
		if (this.room instanceof Rooms.GlobalRoom) return false;
		if (!this.broadcasting && this.cmdToken === BROADCAST_TOKEN) {
			if (!this.pmTarget && !this.user.can('broadcast', null, this.room)) {
				this.errorReply("You need to be voiced to broadcast this command's information.");
				this.errorReply("To see it for yourself, use: /" + this.message.substr(1));
				return false;
			}

			// broadcast cooldown
			const broadcastMessage = (suppressMessage || this.message).toLowerCase().replace(/[^a-z0-9\s!,]/g, '');

			if (!ignoreCooldown && this.room && this.room.lastBroadcast === broadcastMessage &&
				this.room.lastBroadcastTime >= Date.now() - BROADCAST_COOLDOWN &&
				!this.user.can('bypassall')) {

				this.errorReply("You can't broadcast this because it was just broadcasted.");
				return false;
			}

			const message = this.canTalk(suppressMessage || this.message);
			if (!message) return false;

			// canTalk will only return true with no message
			this.message = message ;
			this.broadcastMessage = broadcastMessage;
		}
		return true;
	}
	runBroadcast(ignoreCooldown = false, suppressMessage = null) {
		if (this.broadcasting || this.cmdToken !== BROADCAST_TOKEN) {
			// Already being broadcast, or the user doesn't intend to broadcast.
			return true;
		}

		if (!this.broadcastMessage) {
			// Permission hasn't been checked yet. Do it now.
			if (!this.canBroadcast(ignoreCooldown, suppressMessage)) return false;
		}

		this.broadcasting = true;

		if (this.pmTarget) {
			this.sendReply('|c~|' + (suppressMessage || this.message));
		} else {
			this.sendReply('|c|' + this.user.getIdentity(this.room.roomid) + '|' + (suppressMessage || this.message));
		}
		if (!ignoreCooldown && !this.pmTarget) {
			this.room.lastBroadcast = this.broadcastMessage;
			this.room.lastBroadcastTime = Date.now();
		}

		return true;
	}
	canTalk(message = null, room = null, targetUser = null) {
		if (!targetUser && this.pmTarget) {
			targetUser = this.pmTarget;
		}
		if (targetUser) {
			room = null;
		} else if (!room) {
			if (this.room.roomid === 'global') {
				this.connection.popup(`Your message could not be sent:\n\n${message}\n\nIt needs to be sent to a user or room.`);
				return false;
			}
			// @ts-ignore excludes GlobalRoom above
			room = this.room;
		}
		const user = this.user;
		const connection = this.connection;

		if (!user.named) {
			connection.popup(this.tr(`You must choose a name before you can talk.`));
			return false;
		}
		if (!user.can('bypassall')) {
			const lockType = (user.namelocked ? this.tr(`namelocked`) : user.locked ? this.tr(`locked`) : ``);
			const lockExpiration = Punishments.checkLockExpiration(user.namelocked || user.locked);
			if (room) {
				if (lockType && !room.isHelp) {
					this.errorReply(this.tr `You are ${lockType} and can't talk in chat. ${lockExpiration}`);
					this.sendReply(`|html|<a href="view-help-request--appeal" class="button">${this.tr("Get help with this")}</a>`);
					return false;
				}
				if (room.isMuted(user)) {
					this.errorReply(this.tr(`You are muted and cannot talk in this room.`));
					return false;
				}
				if (room.modchat && !user.authAtLeast(room.modchat, room)) {
					if (room.modchat === 'autoconfirmed') {
						this.errorReply(this.tr(`Because moderated chat is set, your account must be at least one week old and you must have won at least one ladder game to speak in this room.`));
						return false;
					}
					if (room.modchat === 'trusted') {
						this.errorReply(this.tr(`Because moderated chat is set, your account must be staff in a public room or have a global rank to speak in this room.`));
						return false;
					}
					const groupName = Config.groups[room.modchat] && Config.groups[room.modchat].name || room.modchat;
					this.errorReply(this.tr `Because moderated chat is set, you must be of rank ${groupName} or higher to speak in this room.`);
					return false;
				}
				if (!(user.id in room.users)) {
					connection.popup(`You can't send a message to this room without being in it.`);
					return false;
				}
			}
			// TODO: translate these messages. Currently there isn't much of a point since languages are room-dependent, and these PM-related messages aren't
			// attached to any rooms. If we ever get to letting users set their own language these messages should also be translated. - Asheviere
			if (targetUser) {
				if (lockType && !targetUser.can('lock')) {
					this.errorReply(`You are ${lockType} and can only private message members of the global moderation team. ${lockExpiration}`);
					return this.sendReply(`|html|<a href="view-help-request--appeal" class="button">Get help with this</a>`);
				}
				if (targetUser.locked && !user.can('lock')) {
					return this.errorReply(`The user "${targetUser.name}" is locked and cannot be PMed.`);
				}
				if (Config.pmmodchat && !user.authAtLeast(Config.pmmodchat) &&
					!targetUser.canPromote(user.group, Config.pmmodchat)) {

					const groupName = Config.groups[Config.pmmodchat] && Config.groups[Config.pmmodchat].name || Config.pmmodchat;
					return this.errorReply(`On this server, you must be of rank ${groupName} or higher to PM users.`);
				}
				if (targetUser.blockPMs &&
					(targetUser.blockPMs === true || !user.authAtLeast(targetUser.blockPMs)) &&
					!user.can('lock')) {

					exports.Chat.maybeNotifyBlocked('pm', targetUser, user);
					if (!targetUser.can('lock')) {
						return this.errorReply(`This user is blocking private messages right now.`);
					} else {
						this.errorReply(`This ${Config.groups[targetUser.group].name} is too busy to answer private messages right now. Please contact a different staff member.`);
						return this.sendReply(`|html|If you need help, try opening a <a href="view-help-request" class="button">help ticket</a>`);
					}
				}
				if (user.blockPMs && (user.blockPMs === true
					|| !targetUser.authAtLeast(user.blockPMs)) && !targetUser.can('lock')) {
					return this.errorReply(`You are blocking private messages right now.`);
				}
			}
		}

		if (typeof message !== 'string') return true;

		if (!message) {
			connection.popup(this.tr("Your message can't be blank."));
			return false;
		}
		let length = message.length;
		length += 10 * message.replace(/[^\ufdfd]*/g, '').length;
		if (length > MAX_MESSAGE_LENGTH && !user.can('ignorelimits')) {
			this.errorReply(this.tr("Your message is too long: ") + message);
			return false;
		}

		// remove zalgo
		// tslint:disable-next-line: max-line-length
		message = message.replace(/[\u0300-\u036f\u0483-\u0489\u0610-\u0615\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]{3,}/g, '');
		if (/[\u115f\u1160\u239b-\u23b9]/.test(message)) {
			this.errorReply(this.tr("Your message contains banned characters."));
			return false;
		}

		// If the corresponding config option is set, non-AC users cannot send links, except to staff.
		if (Config.restrictLinks && !user.autoconfirmed) {
			const links = message.match(exports.Chat.linkRegex);
			const allLinksWhitelisted = !links || links.every(link => {
				link = link.toLowerCase();
				const domainMatches = /^(?:http:\/\/|https:\/\/)?(?:[^/]*\.)?([^/.]*\.[^/.]*)\.?($|\/|:)/.exec(link);
				const domain = domainMatches && domainMatches[1];
				const hostMatches = /^(?:http:\/\/|https:\/\/)?([^/]*[^/.])\.?($|\/|:)/.exec(link);
				let host = hostMatches && hostMatches[1];
				if (host && host.startsWith('www.')) host = host.slice(4);
				if (!domain || !host) return false;
				return LINK_WHITELIST.includes(host) || LINK_WHITELIST.includes(`*.${domain}`);
			});
			if (!allLinksWhitelisted && !(targetUser && targetUser.can('lock') || (room && room.isHelp))) {
				this.errorReply("Your account must be autoconfirmed to send links to other users, except for global staff.");
				return false;
			}
		}

		if (!this.checkFormat(room, user, message)) {
			return false;
		}

		if (!this.checkSlowchat(room, user)) {
			// @ts-ignore ~ The truthiness of room and room.slowchat are evaluated in checkSlowchat
			this.errorReply(this.tr `This room has slow-chat enabled. You can only talk once every ${room.slowchat} seconds.`);
			return false;
		}

		if (!this.checkBanwords(room, user.name) && !user.can('bypassall')) {
			this.errorReply(this.tr(`Your username contains a phrase banned by this room.`));
			return false;
		}
		if (user.userMessage && (!this.checkBanwords(room, user.userMessage) && !user.can('bypassall'))) {
			this.errorReply(this.tr(`Your status message contains a phrase banned by this room.`));
			return false;
		}
		if (!this.checkBanwords(room, message) && !user.can('mute', null, room)) {
			this.errorReply(this.tr("Your message contained banned words in this room."));
			return false;
		}

		const gameFilter = this.checkGameFilter();
		if (gameFilter && !user.can('bypassall')) {
			this.errorReply(gameFilter);
			return false;
		}

		if (room) {
			const normalized = message.trim();
			if (!user.can('bypassall') && (['help', 'lobby'].includes(room.roomid)) && (normalized === user.lastMessage) &&
					((Date.now() - user.lastMessageTime) < MESSAGE_COOLDOWN)) {
				this.errorReply(this.tr("You can't send the same message again so soon."));
				return false;
			}
			user.lastMessage = message;
			user.lastMessageTime = Date.now();
		}

		if (room && room.highTraffic &&
			toID(message).replace(/[^a-z]+/, '').length < 2
			&& !user.can('broadcast', null, room)) {
			this.errorReply(
				this.tr('Due to this room being a high traffic room, your message must contain at least two letters.')
			);
			return false;
		}

		if (exports.Chat.filters.length) {
			return exports.Chat.filter(this, message, user, room, connection, targetUser);
		}

		return message;
	}
	canEmbedURI(uri, isRelative = false) {
		if (uri.startsWith('https://')) return uri;
		if (uri.startsWith('//')) return uri;
		if (uri.startsWith('data:')) return uri;
		if (!uri.startsWith('http://')) {
			if (/^[a-z]+:\/\//.test(uri) || isRelative) {
				this.errorReply("URIs must begin with 'https://' or 'http://' or 'data:'");
				return null;
			}
		} else {
			uri = uri.slice(7);
		}
		const slashIndex = uri.indexOf('/');
		let domain = (slashIndex >= 0 ? uri.slice(0, slashIndex) : uri);

		// heuristic that works for all the domains we care about
		const secondLastDotIndex = domain.lastIndexOf('.', domain.length - 5);
		if (secondLastDotIndex >= 0) domain = domain.slice(secondLastDotIndex + 1);

		const approvedDomains = {
			'imgur.com': 1,
			'gyazo.com': 1,
			'puu.sh': 1,
			'rotmgtool.com': 1,
			'pokemonshowdown.com': 1,
			'nocookie.net': 1,
			'blogspot.com': 1,
			'imageshack.us': 1,
			'deviantart.net': 1,
			'd.pr': 1,
			'pokefans.net': 1,
		};
		if (domain in approvedDomains) {
			return '//' + uri;
		}
		if (domain === 'bit.ly') {
			this.errorReply("Please don't use URL shorteners.");
			return null;
		}
		// unknown URI, allow HTTP to be safe
		return 'http://' + uri;
	}
	canHTML(htmlContent) {
		htmlContent = ('' + (htmlContent || '')).trim();
		if (!htmlContent) return '';
		const images = /<img\b[^<>]*/ig;
		let match;
		// tslint:disable-next-line: no-conditional-assignment tslint doesn't support allowing ((assignment))
		while ((match = images.exec(htmlContent))) {
			if (this.room.isPersonal && !this.user.can('announce')) {
				this.errorReply("Images are not allowed in personal rooms.");
				return null;
			}
			if (!/width=([0-9]+|"[0-9]+")/i.test(match[0]) || !/height=([0-9]+|"[0-9]+")/i.test(match[0])) {
				// Width and height are required because most browsers insert the
				// <img> element before width and height are known, and when the
				// image is loaded, this changes the height of the chat area, which
				// messes up autoscrolling.
				this.errorReply('All images must have a width and height attribute');
				return null;
			}
			const srcMatch = /src\s*=\s*"?([^ "]+)(\s*")?/i.exec(match[0]);
			if (srcMatch) {
				const uri = this.canEmbedURI(srcMatch[1], true);
				if (!uri) return null;
				htmlContent = `${htmlContent.slice(0, match.index + srcMatch.index)}src="${uri}"${htmlContent.slice(match.index + srcMatch.index + srcMatch[0].length)}`;
				// lastIndex is inaccurate since html was changed
				images.lastIndex = match.index + 11;
			}
		}
		if ((this.room.isPersonal || this.room.isPrivate === true)
		&& !this.user.can('lock') && htmlContent.replace(/\s*style\s*=\s*"?[^"]*"\s*>/g, '>').match(/<button[^>]/)) {
			this.errorReply('You do not have permission to use scripted buttons in HTML.');
			this.errorReply('If you just want to link to a room, you can do this: <a href="/roomid"><button>button contents</button></a>');
			return null;
		}
		if (/>here.?</i.test(htmlContent) || /click here/i.test(htmlContent)) {
			this.errorReply('Do not use "click here"');
			return null;
		}

		// check for mismatched tags
		// tslint:disable-next-line: max-line-length
		const tags = htmlContent.toLowerCase().match(/<\/?(div|a|button|b|strong|em|i|u|center|font|marquee|blink|details|summary|code|table|td|tr|style|script)\b/g);
		if (tags) {
			const stack = [];
			for (const tag of tags) {
				if (tag.charAt(1) === '/') {
					if (!stack.length) {
						this.errorReply("Extraneous </" + tag.substr(2) + "> without an opening tag.");
						return null;
					}
					if (tag.substr(2) !== stack.pop()) {
						this.errorReply("Missing </" + tag.substr(2) + "> or it's in the wrong place.");
						return null;
					}
				} else {
					stack.push(tag.substr(1));
				}
			}
			if (stack.length) {
				this.errorReply("Missing </" + stack.pop() + ">.");
				return null;
			}
		}

		return htmlContent;
	}
	targetUserOrSelf(target, exactName) {
		if (!target) {
			this.targetUsername = this.user.name;
			this.inputUsername = this.user.name;
			return this.user;
		}
		this.splitTarget(target, exactName);
		return this.targetUser;
	}

	/**
	 * Given a message in the form "USERNAME" or "USERNAME, MORE", splits
	 * it apart:
	 *
	 * - `this.targetUser` will be the User corresponding to USERNAME
	 *   (or null, if not found)
	 *
	 * - `this.inputUsername` will be the text of USERNAME, unmodified
	 *
	 * - `this.targetUsername` will be the username, if found, or
	 *   this.inputUsername otherwise
	 *
	 * - and the text of MORE will be returned (empty string, if the
	 *   message has no comma)
	 *
	 */
	splitTarget(target, exactName = false) {
		const [name, rest] = this.splitOne(target);

		this.targetUser = Users.get(name, exactName);
		this.inputUsername = name.trim();
		this.targetUsername = this.targetUser ? this.targetUser.name : this.inputUsername;
		return rest;
	}
} exports.CommandContext = CommandContext;

 const Chat = new (_class = class {
	constructor() {;_class.prototype.__init.call(this);_class.prototype.__init2.call(this);_class.prototype.__init3.call(this);_class.prototype.__init4.call(this);_class.prototype.__init5.call(this);_class.prototype.__init6.call(this);_class.prototype.__init7.call(this);_class.prototype.__init8.call(this);_class.prototype.__init9.call(this);_class.prototype.__init10.call(this);_class.prototype.__init11.call(this);_class.prototype.__init12.call(this);_class.prototype.__init13.call(this);_class.prototype.__init14.call(this);_class.prototype.__init15.call(this);_class.prototype.__init16.call(this);_class.prototype.__init17.call(this);_class.prototype.__init18.call(this);_class.prototype.__init19.call(this);_class.prototype.__init20.call(this);_class.prototype.__init21.call(this);_class.prototype.__init22.call(this);_class.prototype.__init23.call(this);_class.prototype.__init24.call(this);_class.prototype.__init25.call(this);
		void this.loadTranslations();
	}
	__init() {this.multiLinePattern = new PatternTester()}

	/*********************************************************
	 * Load command files
	 *********************************************************/
	__init2() {this.baseCommands = undefined}
	__init3() {this.commands = undefined}
	__init4() {this.basePages = undefined}
	__init5() {this.pages = undefined}
	__init6() {this.destroyHandlers = []}

	/*********************************************************
	 * Load chat filters
	 *********************************************************/
	__init7() {this.filters = []}
	filter(
		context,
		message,
		user,
		room,
		connection,
		targetUser = null
	) {
		// Chat filters can choose to:
		// 1. return false OR null - to not send a user's message
		// 2. return an altered string - to alter a user's message
		// 3. return undefined to send the original message through
		const originalMessage = message;
		for (const curFilter of exports.Chat.filters) {
			const output = curFilter.call(context, message, user, room, connection, targetUser, originalMessage);
			if (!output && output !== undefined) return output;
			if (output !== undefined) message = output;
		}

		return message;
	}

	__init8() {this.namefilters = []}
	namefilter(name, user) {
		if (!Config.disablebasicnamefilter) {
			// whitelist
			// \u00A1-\u00BF\u00D7\u00F7  Latin punctuation/symbols
			// \u02B9-\u0362              basic combining accents
			// \u2012-\u2027\u2030-\u205E Latin punctuation/symbols extended
			// \u2050-\u205F              fractions extended
			// \u2190-\u23FA\u2500-\u2BD1 misc symbols
			// \u2E80-\u32FF              CJK symbols
			// \u3400-\u9FFF              CJK
			// \uF900-\uFAFF\uFE00-\uFE6F CJK extended
			// tslint:disable-next-line: max-line-length
			name = name.replace(/[^a-zA-Z0-9 /\\.~()<>^*%&=+$#_'?!"\u00A1-\u00BF\u00D7\u00F7\u02B9-\u0362\u2012-\u2027\u2030-\u205E\u2050-\u205F\u2190-\u23FA\u2500-\u2BD1\u2E80-\u32FF\u3400-\u9FFF\uF900-\uFAFF\uFE00-\uFE6F-]+/g, '');

			// blacklist
			// \u00a1 upside-down exclamation mark (i)
			// \u2580-\u2590 black bars
			// \u25A0\u25Ac\u25AE\u25B0 black bars
			// \u534d\u5350 swastika
			// \u2a0d crossed integral (f)
			name = name.replace(/[\u00a1\u2580-\u2590\u25A0\u25Ac\u25AE\u25B0\u2a0d\u534d\u5350]/g, '');

			// e-mail address
			if (name.includes('@') && name.includes('.')) return '';

			// url
			// tslint:disable-next-line: max-line-length
			if (/[a-z0-9]\.(com|net|org|us|uk|co|gg|tk|ml|gq|ga|xxx|download|stream|)\b/.test(name)) name = name.replace(/\./g, '');

			// Limit the amount of symbols allowed in usernames to 4 maximum, and disallow (R) and (C) from being used in the middle of names.
			// tslint:disable-next-line: max-line-length
			const nameSymbols = name.replace(/[^\u00A1-\u00BF\u00D7\u00F7\u02B9-\u0362\u2012-\u2027\u2030-\u205E\u2050-\u205F\u2090-\u23FA\u2500-\u2BD1]+/g, '');
			// \u00ae\u00a9 (R) (C)
			// tslint:disable-next-line: max-line-length
			if (nameSymbols.length > 4 || /[^a-z0-9][a-z0-9][^a-z0-9]/.test(name.toLowerCase() + ' ') || /[\u00ae\u00a9].*[a-zA-Z0-9]/.test(name)) name = name.replace(/[\u00A1-\u00BF\u00D7\u00F7\u02B9-\u0362\u2012-\u2027\u2030-\u205E\u2050-\u205F\u2190-\u23FA\u2500-\u2BD1\u2E80-\u32FF\u3400-\u9FFF\uF900-\uFAFF\uFE00-\uFE6F]+/g, '').replace(/[^A-Za-z0-9]{2,}/g, ' ').trim();
		}
		name = name.replace(/^[^A-Za-z0-9]+/, ""); // remove symbols from start
		name = name.replace(/@/g, ""); // Remove @ as this is used to indicate status messages

		// cut name length down to 18 chars
		if (/[A-Za-z0-9]/.test(name.slice(18))) {
			name = name.replace(/[^A-Za-z0-9]+/g, "");
		} else {
			name = name.slice(0, 18);
		}

		name = Dex.getName(name);
		for (const curFilter of exports.Chat.namefilters) {
			name = curFilter(name, user);
			if (!name) return '';
		}
		return name;
	}

	__init9() {this.hostfilters = []}
	hostfilter(host, user, connection, hostType) {
		for (const curFilter of exports.Chat.hostfilters) {
			curFilter(host, user, connection, hostType);
		}
	}

	__init10() {this.loginfilters = []}
	loginfilter(user, oldUser, usertype) {
		for (const curFilter of exports.Chat.loginfilters) {
			curFilter(user, oldUser, usertype);
		}
	}

	__init11() {this.nicknamefilters = []}
	nicknamefilter(nickname, user) {
		for (const curFilter of exports.Chat.nicknamefilters) {
			nickname = curFilter(nickname, user);
			if (!nickname) return '';
		}
		return nickname;
	}

	__init12() {this.statusfilters = []}
	statusfilter(status, user) {
		status = status.replace(/\|/g, '');
		for (const curFilter of exports.Chat.statusfilters) {
			status = curFilter(status, user);
			if (!status) return '';
		}
		return status;
	}
	/*********************************************************
	 * Translations
	 *********************************************************/
	/** language id -> language name */
	__init13() {this.languages = new Map()}
	/** language id -> (english string -> translated string) */
	__init14() {this.translations = new Map()}

	loadTranslations() {
		return _fs.FS.call(void 0, TRANSLATION_DIRECTORY).readdir().then(files => {
			for (const fname of files) {
				if (!fname.endsWith('.json')) continue;

				


				const content = require(`../${TRANSLATION_DIRECTORY}${fname}`);
				const id = fname.slice(0, -5);

				exports.Chat.languages.set(id, content.name || "Unknown Language");
				exports.Chat.translations.set(id, new Map());

				if (content.strings) {
					for (const key in content.strings) {
						const keyLabels = [];
						const valLabels = [];
						const newKey = key.replace(/\${.+?}/g, str => {
							keyLabels.push(str);
							return '${}';
						}).replace(/\[TN: ?.+?\]/g, '');
						const val = content.strings[key].replace(/\${.+?}/g, (str) => {
							valLabels.push(str);
							return '${}';
						}).replace(/\[TN: ?.+?\]/g, '');
						exports.Chat.translations.get(id).set(newKey, [val, keyLabels, valLabels]);
					}
				}
			}
		});
	}
	

	tr(language, strings = '', ...keys) {
		if (!language) language = 'english';
		language = toID(language);
		if (!exports.Chat.translations.has(language)) throw new Error(`Trying to translate to a nonexistent language: ${language}`);
		if (!strings.length) {
			return ((fStrings, ...fKeys) => {
				return exports.Chat.tr(language, fStrings, ...fKeys);
			});
		}

		// If strings is an array (normally the case), combine before translating.
		const trString = Array.isArray(strings) ? strings.join('${}') : strings ;

		const entry = exports.Chat.translations.get(language).get(trString);
		let [translated, keyLabels, valLabels] = entry || ["", [], []];
		if (!translated) translated = trString;

		// Replace the gaps in the template string
		if (keys.length) {
			let reconstructed = '';

			const left = keyLabels.slice();
			for (const [i, str] of translated.split('${}').entries()) {
				reconstructed += str;
				if (keys[i]) {
					let index = left.indexOf(valLabels[i]);
					if (index < 0) {
						index = left.findIndex(val => !!val);
					}
					if (index < 0) index = i;
					reconstructed += keys[index];
					left[index] = null;
				}
			}

			translated = reconstructed;
		}
		return translated;
	}

	__init15() {this.MessageContext = MessageContext};
	__init16() {this.CommandContext = exports.CommandContext = CommandContext};
	__init17() {this.PageContext = exports.PageContext = PageContext};
	/**
	 * Command parser
	 *
	 * Usage:
	 *   Chat.parse(message, room, user, connection)
	 *
	 * Parses the message. If it's a command, the command is executed, if
	 * not, it's displayed directly in the room.
	 *
	 * Examples:
	 *   Chat.parse("/join lobby", room, user, connection)
	 *     will make the user join the lobby.
	 *
	 *   Chat.parse("Hi, guys!", room, user, connection)
	 *     will return "Hi, guys!" if the user isn't muted, or
	 *     if he's muted, will warn him that he's muted.
	 *
	 * The return value is the return value of the command handler, if any,
	 * or the message, if there wasn't a command. This value could be a success
	 * or failure (few commands report these) or a Promise for when the command
	 * is done executing, if it's not currently done.
	 *
	 * @param message - the message the user is trying to say
	 * @param room - the room the user is trying to say it in
	 * @param user - the user that sent the message
	 * @param connection - the connection the user sent the message from
	 */
	parse(message, room, user, connection) {
		exports.Chat.loadPlugins();
		const context = new CommandContext({message, room, user, connection});

		return context.parse();
	}
	sendPM(message, user, pmTarget, onlyRecipient = null) {
		const buf = `|pm|${user.getIdentity()}|${pmTarget.getIdentity()}|${message}`;
		if (onlyRecipient) return onlyRecipient.send(buf);
		user.send(buf);
		if (pmTarget !== user) pmTarget.send(buf);
		pmTarget.lastPM = user.id;
		user.lastPM = pmTarget.id;
	}

	__init18() {this.packageData = {}};

	uncacheTree(root) {
		let toUncache = [require.resolve('../' + root)];
		do {
			const newuncache = [];
			for (const target of toUncache) {
				if (require.cache[target]) {
					// cachedModule
					const children = require.cache[target].children;
					newuncache.push(
						...(children
							.filter(cachedModule => !cachedModule.id.endsWith('.node'))
							.map(cachedModule => cachedModule.id))
					);
					delete require.cache[target];
				}
			}
			toUncache = newuncache;
		} while (toUncache.length > 0);
	}

	uncacheDir(root) {
		const absoluteRoot = _fs.FS.call(void 0, root).path;
		for (const key in require.cache) {
			if (key.startsWith(absoluteRoot)) {
				delete require.cache[key];
			}
		}
	}

	uncache(path) {
		const absolutePath = require.resolve('../' + path);
		delete require.cache[absolutePath];
	}

	loadPlugin(file) {
		let plugin;
		if (file.endsWith('.ts')) {
			plugin = require(`./chat-plugins/${file.slice(0, -3)}`);
		} else if (file.endsWith('.js')) {
			// Switch to server/ because we'll be in .server-dist/ after this file is compiled
			plugin = require(`../server/chat-plugins/${file}`);
		} else {
			return;
		}
		Object.assign(exports.Chat.commands, plugin.commands);
		Object.assign(exports.Chat.pages, plugin.pages);

		if (plugin.destroy) exports.Chat.destroyHandlers.push(plugin.destroy);

		if (plugin.chatfilter) exports.Chat.filters.push(plugin.chatfilter);
		if (plugin.namefilter) exports.Chat.namefilters.push(plugin.namefilter);
		if (plugin.hostfilter) exports.Chat.hostfilters.push(plugin.hostfilter);
		if (plugin.loginfilter) exports.Chat.loginfilters.push(plugin.loginfilter);
		if (plugin.nicknamefilter) exports.Chat.nicknamefilters.push(plugin.nicknamefilter);
		if (plugin.statusfilter) exports.Chat.statusfilters.push(plugin.statusfilter);
	}

	loadPlugins() {
		if (exports.Chat.commands) return;

		void _fs.FS.call(void 0, 'package.json').readIfExists().then(data => {
			if (data) exports.Chat.packageData = JSON.parse(data);
		});

		// prevent TypeScript from resolving
		const commandsFile = '../server/chat-commands';
		exports.Chat.baseCommands = require(commandsFile).commands;
		exports.Chat.basePages = require(commandsFile).pages;
		exports.Chat.commands = Object.assign({}, exports.Chat.baseCommands);
		exports.Chat.pages = Object.assign({}, exports.Chat.basePages);

		if (Config.chatfilter) exports.Chat.filters.push(Config.chatfilter);
		if (Config.namefilter) exports.Chat.namefilters.push(Config.namefilter);
		if (Config.hostfilter) exports.Chat.hostfilters.push(Config.hostfilter);
		if (Config.loginfilter) exports.Chat.loginfilters.push(Config.loginfilter);
		if (Config.nicknamefilter) exports.Chat.nicknamefilters.push(Config.nicknamefilter);
		if (Config.statusfilter) exports.Chat.statusfilters.push(Config.statusfilter);

		// Install plug-in commands and chat filters

		// All resulting filenames will be relative to basePath
		const getFiles = (basePath, path) => {
			const filesInThisDir = _fs.FS.call(void 0, `${basePath}/${path}`).readdirSync();
			let allFiles = [];
			for (const file of filesInThisDir) {
				const fileWithPath = path + (path ? '/' : '') + file;
				if (_fs.FS.call(void 0, `${basePath}/${fileWithPath}`).isDirectorySync()) {
					if (file.startsWith('.')) continue;
					allFiles = allFiles.concat(getFiles(basePath, fileWithPath));
				} else {
					allFiles.push(fileWithPath);
				}
			}
			return allFiles;
		};
		let files = _fs.FS.call(void 0, 'server/chat-plugins').readdirSync();
		// info always goes first so other plugins can shadow it, and private plugins are loaded separately
		files = files.filter(file => file !== 'info.js' && file !== 'private');
		files.unshift('info.js');
		try {
			if (_fs.FS.call(void 0, 'server/chat-plugins/private').isDirectorySync()) {
				files = files.concat(getFiles('server/chat-plugins', 'private'));
			}
		} catch (err) {
			if (err.code !== 'ENOENT') throw err;
		}

		for (const file of files) {
			this.loadPlugin(file);
		}
	}
	destroy() {
		for (const handler of exports.Chat.destroyHandlers) {
			handler();
		}
	}

	/**
	 * Escapes HTML in a string.
	 */
	escapeHTML(str) {
		if (!str) return '';
		return ('' + str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;')
			.replace(/\//g, '&#x2f;');
	}

	/**
	 * Strips HTML from a string.
	 */
	stripHTML(htmlContent) {
		if (!htmlContent) return '';
		return htmlContent.replace(/<[^>]*>/g, '');
	}

	/**
	 * Template string tag function for escaping HTML
	 */
	html(strings, ...args) {
		let buf = strings[0];
		let i = 0;
		while (i < args.length) {
			buf += this.escapeHTML(args[i]);
			buf += strings[++i];
		}
		return buf;
	}

	/**
	 * Returns singular (defaulting to '') if num is 1, or plural
	 * (defaulting to 's') otherwise. Helper function for pluralizing
	 * words.
	 */
	plural(num, pluralSuffix = 's', singular = '') {
		if (num && typeof num.length === 'number') {
			num = num.length;
		} else if (num && typeof num.size === 'number') {
			num = num.size;
		} else {
			num = Number(num);
		}
		return (num !== 1 ? pluralSuffix : singular);
	}

	/**
	 * Counts the thing passed.
	 *
	 *     Chat.count(2, "days") === "2 days"
	 *     Chat.count(1, "days") === "1 day"
	 *     Chat.count(["foo"], "things are") === "1 thing is"
	 *
	 */
	count(num, pluralSuffix, singular = "") {
		if (num && typeof num.length === 'number') {
			num = num.length;
		} else if (num && typeof num.size === 'number') {
			num = num.size;
		} else {
			num = Number(num);
		}
		if (!singular) {
			if (pluralSuffix.endsWith("s")) {
				singular = pluralSuffix.slice(0, -1);
			} else if (pluralSuffix.endsWith("s have")) {
				singular = pluralSuffix.slice(0, -6) + " has";
			} else if (pluralSuffix.endsWith("s were")) {
				singular = pluralSuffix.slice(0, -6) + " was";
			}
		}
		const space = singular.startsWith('<') ? '' : ' ';
		return `${num}${space}${num > 1 ? pluralSuffix : singular}`;
	}

	/**
	 * Like string.split(delimiter), but only recognizes the first `limit`
	 * delimiters (default 1).
	 *
	 * `"1 2 3 4".split(" ", 2) => ["1", "2"]`
	 *
	 * `Chat.splitFirst("1 2 3 4", " ", 1) => ["1", "2 3 4"]`
	 *
	 * Returns an array of length exactly limit + 1.
	 *
	 */
	splitFirst(str, delimiter, limit = 1) {
		const splitStr = [];
		while (splitStr.length < limit) {
			const delimiterIndex = str.indexOf(delimiter);
			if (delimiterIndex >= 0) {
				splitStr.push(str.slice(0, delimiterIndex));
				str = str.slice(delimiterIndex + delimiter.length);
			} else {
				splitStr.push(str);
				str = '';
			}
		}
		splitStr.push(str);
		return splitStr;
	}

	/**
	 * Returns a timestamp in the form {yyyy}-{MM}-{dd} {hh}:{mm}:{ss}.
	 *
	 * options.human = true will reports hours human-readable
	 */
	toTimestamp(date, options = {}) {
		const human = options.human;
		let parts = [
			date.getFullYear(),	date.getMonth() + 1, date.getDate(),
			date.getHours(), date.getMinutes(),	date.getSeconds(),
		];
		if (human) {
			parts.push(parts[3] >= 12 ? 'pm' : 'am');
			parts[3] = parts[3] % 12 || 12;
		}
		parts = parts.map(val => val < 10 ? '0' + val : '' + val);
		return parts.slice(0, 3).join("-") + " " + parts.slice(3, human ? 5 : 6).join(":") + (human ? "" + parts[6] : "");
	}

	/**
	 * Takes a number of milliseconds, and reports the duration in English: hours, minutes, etc.
	 *
	 * options.hhmmss = true will instead report the duration in 00:00:00 format
	 *
	 */
	toDurationString(val, options = {}) {
		// TODO: replace by Intl.DurationFormat or equivalent when it becomes available (ECMA-402)
		// https://github.com/tc39/ecma402/issues/47
		const date = new Date(+val);
		const parts = [
			date.getUTCFullYear() - 1970, date.getUTCMonth(), date.getUTCDate() - 1,
			date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(),
		];
		const roundingBoundaries = [6, 15, 12, 30, 30];
		const unitNames = ["second", "minute", "hour", "day", "month", "year"];
		const positiveIndex = parts.findIndex(elem => elem > 0);
		const precision = (options && options.precision ? options.precision : parts.length);
		if (options && options.hhmmss) {
			const str = parts.slice(positiveIndex).map(value => value < 10 ? "0" + value : "" + value).join(":");
			return str.length === 2 ? "00:" + str : str;
		}
		// round least significant displayed unit
		if (positiveIndex + precision < parts.length && precision > 0 && positiveIndex >= 0) {
			if (parts[positiveIndex + precision] >= roundingBoundaries[positiveIndex + precision - 1]) {
				parts[positiveIndex + precision - 1]++;
			}
		}
		return parts
			.slice(positiveIndex)
			.reverse()
			.map((value, index) => value ? value + " " + unitNames[index] + (value > 1 ? "s" : "") : "")
			.reverse()
			.slice(0, precision)
			.join(" ")
			.trim();
	}

	/**
	 * Takes an array and turns it into a sentence string by adding commas and the word "and"
	 */
	toListString(arr) {
		if (!arr.length) return '';
		if (arr.length === 1) return arr[0];
		if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
		return `${arr.slice(0, -1).join(", ")}, and ${arr.slice(-1)[0]}`;
	}

	/**
	 * Takes an array and turns it into a sentence string by adding commas and the word "or"
	 */
	toOrList(arr) {
		if (!arr.length) return '';
		if (arr.length === 1) return arr[0];
		if (arr.length === 2) return `${arr[0]} or ${arr[1]}`;
		return `${arr.slice(0, -1).join(", ")}, or ${arr.slice(-1)[0]}`;
	}

	collapseLineBreaksHTML(htmlContent) {
		htmlContent = htmlContent.replace(/<[^>]*>/g, tag => tag.replace(/\n/g, ' '));
		htmlContent = htmlContent.replace(/\n/g, '&#10;');
		return htmlContent;
	}

	getDataPokemonHTML(template, gen = 7, tier = '') {
		if (typeof template === 'string') template = Object.assign({}, Dex.getTemplate(template));
		let buf = '<li class="result">';
		buf += '<span class="col numcol">' + (tier || template.tier) + '</span> ';
		buf += `<span class="col iconcol"><psicon pokemon="${template.id}"/></span> `;
		buf += `<span class="col pokemonnamecol" style="white-space:nowrap"><a href="https://${Config.routes.dex}/pokemon/${template.id}" target="_blank">${template.species}</a></span> `;
		buf += '<span class="col typecol">';
		if (template.types) {
			for (const type of template.types) {
				buf += `<img src="https://${Config.routes.client}/sprites/types/${type}.png" alt="${type}" height="14" width="32">`;
			}
		}
		buf += '</span> ';
		if (gen >= 3) {
			buf += '<span style="float:left;min-height:26px">';
			if (template.abilities['1'] && (gen >= 4 || Dex.getAbility(template.abilities['1']).gen === 3)) {
				buf += '<span class="col twoabilitycol">' + template.abilities['0'] + '<br />' + template.abilities['1'] + '</span>';
			} else {
				buf += '<span class="col abilitycol">' + template.abilities['0'] + '</span>';
			}
			if (template.abilities['H'] && template.abilities['S']) {
				buf += '<span class="col twoabilitycol' + (template.unreleasedHidden ? ' unreleasedhacol' : '') + '"><em>' + template.abilities['H'] + '<br />(' + template.abilities['S'] + ')</em></span>';
			} else if (template.abilities['H']) {
				buf += '<span class="col abilitycol' + (template.unreleasedHidden ? ' unreleasedhacol' : '') + '"><em>' + template.abilities['H'] + '</em></span>';
			} else if (template.abilities['S']) {
				// special case for Zygarde
				buf += '<span class="col abilitycol"><em>(' + template.abilities['S'] + ')</em></span>';
			} else {
				buf += '<span class="col abilitycol"></span>';
			}
			buf += '</span>';
		}
		let bst = 0;
		for (const baseStat of Object.values(template.baseStats)) {
			bst += baseStat;
		}
		buf += '<span style="float:left;min-height:26px">';
		buf += '<span class="col statcol"><em>HP</em><br />' + template.baseStats.hp + '</span> ';
		buf += '<span class="col statcol"><em>Atk</em><br />' + template.baseStats.atk + '</span> ';
		buf += '<span class="col statcol"><em>Def</em><br />' + template.baseStats.def + '</span> ';
		if (gen <= 1) {
			bst -= template.baseStats.spd;
			buf += '<span class="col statcol"><em>Spc</em><br />' + template.baseStats.spa + '</span> ';
		} else {
			buf += '<span class="col statcol"><em>SpA</em><br />' + template.baseStats.spa + '</span> ';
			buf += '<span class="col statcol"><em>SpD</em><br />' + template.baseStats.spd + '</span> ';
		}
		buf += '<span class="col statcol"><em>Spe</em><br />' + template.baseStats.spe + '</span> ';
		buf += '<span class="col bstcol"><em>BST<br />' + bst + '</em></span> ';
		buf += '</span>';
		buf += '</li>';
		return `<div class="message"><ul class="utilichart">${buf}<li style="clear:both"></li></ul></div>`;
	}
	getDataMoveHTML(move) {
		if (typeof move === 'string') move = Object.assign({}, Dex.getMove(move));
		let buf = `<ul class="utilichart"><li class="result">`;
		buf += `<span class="col movenamecol"><a href="https://${Config.routes.dex}/moves/${move.id}">${move.name}</a></span> `;
		// encoding is important for the ??? type icon
		const encodedMoveType = encodeURIComponent(move.type);
		buf += `<span class="col typecol"><img src="//${Config.routes.client}/sprites/types/${encodedMoveType}.png" alt="${move.type}" width="32" height="14">`;
		buf += `<img src="//${Config.routes.client}/sprites/categories/${move.category}.png" alt="${move.category}" width="32" height="14"></span> `;
		// tslint:disable-next-line: max-line-length
		if (move.basePower) buf += `<span class="col labelcol"><em>Power</em><br>${typeof move.basePower === 'number' ? move.basePower : '—'}</span> `;
		buf += `<span class="col widelabelcol"><em>Accuracy</em><br>${typeof move.accuracy === 'number' ? (move.accuracy + '%') : '—'}</span> `;
		const basePP = move.pp || 1;
		const pp = Math.floor(move.noPPBoosts ? basePP : basePP * 8 / 5);
		buf += `<span class="col pplabelcol"><em>PP</em><br>${pp}</span> `;
		buf += `<span class="col movedesccol">${move.shortDesc || move.desc}</span> `;
		buf += `</li><li style="clear:both"></li></ul>`;
		return buf;
	}
	getDataAbilityHTML(ability) {
		if (typeof ability === 'string') ability = Object.assign({}, Dex.getAbility(ability));
		let buf = `<ul class="utilichart"><li class="result">`;
		buf += `<span class="col namecol"><a href="https://${Config.routes.dex}/abilities/${ability.id}">${ability.name}</a></span> `;
		buf += `<span class="col abilitydesccol">${ability.shortDesc || ability.desc}</span> `;
		buf += `</li><li style="clear:both"></li></ul>`;
		return buf;
	}
	getDataItemHTML(item) {
		if (typeof item === 'string') item = Object.assign({}, Dex.getItem(item));
		let buf = `<ul class="utilichart"><li class="result">`;
		buf += `<span class="col itemiconcol"><psicon item="${item.id}"></span> <span class="col namecol"><a href="https://${Config.routes.dex}/items/${item.id}">${item.name}</a></span> `;
		buf += `<span class="col itemdesccol">${item.shortDesc || item.desc}</span> `;
		buf += `</li><li style="clear:both"></li></ul>`;
		return buf;
	}

	/**
	 * Visualizes eval output in a slightly more readable form
	 */
	stringify(value, depth = 0) {
		if (value === undefined) return `undefined`;
		if (value === null) return `null`;
		if (typeof value === 'number' || typeof value === 'boolean') {
			return `${value}`;
		}
		if (typeof value === 'string') {
			return `"${value}"`; // NOT ESCAPED
		}
		if (typeof value === 'symbol') {
			return value.toString();
		}
		if (Array.isArray(value)) {
			if (depth > 10) return `[array]`;
			return `[` + value.map(elem => exports.Chat.stringify(elem, depth + 1)).join(`, `) + `]`;
		}
		if (value instanceof RegExp || value instanceof Date || value instanceof Function) {
			if (depth && value instanceof Function) return `Function`;
			return `${value}`;
		}
		let constructor = '';
		if (value.constructor && value.constructor.name && typeof value.constructor.name === 'string') {
			constructor = value.constructor.name;
			if (constructor === 'Object') constructor = '';
		} else {
			constructor = 'null';
		}
		if (value.toString) {
			try {
				const stringValue = value.toString();
				if (typeof stringValue === 'string' &&
						stringValue !== '[object Object]' &&
						stringValue !== `[object ${constructor}]`) {
					return `${constructor}(${stringValue})`;
				}
			} catch (e) {}
		}
		let buf = '';
		for (const key in value) {
			if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
			if (depth > 2 || (depth && constructor)) {
				buf = '...';
				break;
			}
			if (buf) buf += `, `;
			let displayedKey = key;
			if (!/^[A-Za-z0-9_$]+$/.test(key)) displayedKey = JSON.stringify(key);
			buf += `${displayedKey}: ` + exports.Chat.stringify(value[key], depth + 1);
		}
		if (constructor && !buf && constructor !== 'null') return constructor;
		return `${constructor}{${buf}}`;
	}

	/**
	 * Gets the dimension of the image at url. Returns 0x0 if the image isn't found, as well as the relevant error.
	 */
	getImageDimensions(url) {
		return new Promise(resolve => {
			probe(url).then(dimensions => resolve(dimensions), (err) => resolve({height: 0, width: 0, err}));
		});
	}

	/**
	 * Generates dimensions to fit an image at url into a maximum size of maxWidth x maxHeight,
	 * preserving aspect ratio.
	 */
	async fitImage(url, maxHeight = 300, maxWidth = 300) {
		const {height, width} = await exports.Chat.getImageDimensions(url);

		if (width <= maxWidth && height <= maxHeight) return [width, height];

		let ratio;
		if (height * (maxWidth / maxHeight) > width) {
			ratio = maxHeight / height;
		} else {
			ratio = maxWidth / width;
		}

		return [Math.round(width * ratio), Math.round(height * ratio)];
	}

	/**
	 * Notifies a targetUser that a user was blocked from reaching them due to a setting they have enabled.
	 */
	maybeNotifyBlocked(blocked, targetUser, user) {
		const prefix = `|pm|~|${targetUser.getIdentity()}|/nonotify `;
		const options = 'or change it in the <button name="openOptions" class="subtle">Options</button> menu in the upper right.';
		if (blocked === 'pm') {
			if (!targetUser.blockPMsNotified) {
				targetUser.send(`${prefix}The user '${user.name}' attempted to PM you but was blocked. To enable PMs, use /unblockpms ${options}`);
				targetUser.blockPMsNotified = true;
			}
		} else if (blocked === 'challenge') {
			if (!targetUser.blockChallengesNotified) {
				targetUser.send(`${prefix}The user '${user.name}' attempted to challenge you to a battle but was blocked. To enable challenges, use /unblockchallenges ${options}`);
				targetUser.blockChallengesNotified = true;
			}
		}
	}
	__init19() {this.formatText = _chatformatter.formatText};
	__init20() {this.linkRegex = _chatformatter.linkRegex};
	__init21() {this.stripFormatting = _chatformatter.stripFormatting};

	__init22() {this.filterWords = {}};
	__init23() {this.monitors = {}};
	__init24() {this.namefilterwhitelist = new Map()};
	/**
	 * Inappropriate userid : number of times the name has been forcerenamed
	 */
	__init25() {this.forceRenames = new Map()};

	registerMonitor(id, entry) {
		if (!exports.Chat.filterWords[id]) exports.Chat.filterWords[id] = [];
		exports.Chat.monitors[id] = entry;
	}

	resolvePage(pageid, user, connection) {
		return (new PageContext({pageid, user, connection})).resolve();
	}
}, _class); exports.Chat = Chat;

/**
 * Used by ChatMonitor.
 */


















