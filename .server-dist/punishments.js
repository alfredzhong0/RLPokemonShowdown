"use strict";Object.defineProperty(exports, "__esModule", {value: true}); var _class;/**
 * Punishments
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * Handles the punishing of users on PS.
 *
 * There are four types of global punishments on PS. Locks, bans, namelocks and rangelocks.
 * This file contains the lists of users that have been punished (both IPs and usernames),
 * as well as the functions that handle the execution of said punishments.
 *
 * @license MIT license
 */

var _fs = require('../.lib-dist/fs');



const PUNISHMENT_FILE = 'config/punishments.tsv';
const ROOM_PUNISHMENT_FILE = 'config/room-punishments.tsv';
const SHAREDIPS_FILE = 'config/sharedips.tsv';

const RANGELOCK_DURATION = 60 * 60 * 1000; // 1 hour
const LOCK_DURATION = 48 * 60 * 60 * 1000; // 48 hours
const GLOBALBAN_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week
const BATTLEBAN_DURATION = 48 * 60 * 60 * 1000; // 48 hours

const ROOMBAN_DURATION = 48 * 60 * 60 * 1000; // 48 hours
const BLACKLIST_DURATION = 365 * 24 * 60 * 60 * 1000; // 1 year

const USERID_REGEX = /^[a-z0-9]+$/;
const PUNISH_TRUSTED = false;

const PUNISHMENT_POINT_VALUES = {MUTE: 2, BLACKLIST: 3, BATTLEBAN: 4, ROOMBAN: 4};
const AUTOLOCK_POINT_THRESHOLD = 8;

/**
 * A punishment is an array: [punishType, userid | #punishmenttype, expireTime, reason]
 */










class PunishmentMap extends Map {
	get(k) {
		const punishment = super.get(k);
		if (punishment) {
			if (Date.now() < punishment[2]) return punishment;
			this.delete(k);
		}
		return undefined;
	}
	has(k) {
		return !!this.get(k);
	}
	forEach(callback) {
		for (const [k, punishment] of super.entries()) {
			if (Date.now() < punishment[2]) {
				callback(punishment, k, this);
				continue;
			}
			this.delete(k);
		}
	}
}

class NestedPunishmentMap extends Map {
	nestedSet(k1, k2, value) {
		if (!this.get(k1)) {
			this.set(k1, new Map());
		}
		// guaranteed above
		this.get(k1).set(k2, value);
	}
	nestedGet(k1, k2) {
		const subMap = this.get(k1);
		if (!subMap) return subMap;
		const punishment = subMap.get(k2);
		if (punishment) {
			if (Date.now() < punishment[2]) return punishment;
			this.nestedDelete(k1, k2);
		}
		return undefined;
	}
	nestedHas(k1, k2) {
		return !!this.nestedGet(k1, k2);
	}
	nestedDelete(k1, k2) {
		const subMap = this.get(k1);
		if (!subMap) return;
		subMap.delete(k2);
		if (!subMap.size) this.delete(k1);
	}
	nestedForEach(callback) {
		for (const [k1, subMap] of this.entries()) {
			for (const [k2, punishment] of subMap.entries()) {
				if (Date.now() < punishment[2]) {
					callback(punishment, k1, k2);
					continue;
				}
				this.nestedDelete(k1, k2);
			}
		}
	}
}
/*********************************************************
 * Persistence
 *********************************************************/

 const Punishments = new (_class = class {
	/**
	 * ips is an ip:punishment Map
	 */
	__init() {this.ips = new PunishmentMap()}
	/**
	 * userids is a userid:punishment Map
	 */
	__init2() {this.userids = new PunishmentMap()}
	/**
	 * roomUserids is a roomid:userid:punishment nested Map
	 */
	__init3() {this.roomUserids = new NestedPunishmentMap()}
	/**
	 * roomIps is a roomid:ip:punishment Map
	 */
	__init4() {this.roomIps = new NestedPunishmentMap()}
	/**
	 * sharedIps is an ip:note Map
	 */
	__init5() {this.sharedIps = new Map()}
	/**
	 * Connection flood table. Separate table from IP bans.
	 */
	__init6() {this.cfloods = new Set()}
	/**
	 * punishType is an allcaps string, for global punishments they can be
	 * anything in the punishmentTypes map.
	 *
	 * This map can be extended with custom punishments by chat plugins.
	 *
	 * Keys in the map correspond to punishTypes, values signify the way
	 * they should be displayed in /alt
	 *
	 */
	__init7() {this.punishmentTypes = new Map([
		['LOCK', 'locked'],
		['BAN', 'globally banned'],
		['NAMELOCK', 'namelocked'],
	])}
	/**
	 * For room punishments, they can be anything in the roomPunishmentTypes map.
	 *
	 * This map can be extended with custom punishments by chat plugins.
	 *
	 * Keys in the map correspond to punishTypes, values signify the way they
	 * should be displayed in /alt.
	 * By default, this includes:
	 * - 'ROOMBAN'
	 * - 'BLACKLIST'
	 * - 'BATTLEBAN'
	 * - 'MUTE' (used by getRoomPunishments)
	 *
	 */
	__init8() {this.roomPunishmentTypes = new Map([
		['ROOMBAN', 'banned'],
		['BLACKLIST', 'blacklisted'],
		['BATTLEBAN', 'battlebanned'],
		['MUTE', 'muted'],
	])}
	constructor() {;_class.prototype.__init.call(this);_class.prototype.__init2.call(this);_class.prototype.__init3.call(this);_class.prototype.__init4.call(this);_class.prototype.__init5.call(this);_class.prototype.__init6.call(this);_class.prototype.__init7.call(this);_class.prototype.__init8.call(this);
		setImmediate(() => {
			void exports.Punishments.loadPunishments();
			void exports.Punishments.loadRoomPunishments();
			void exports.Punishments.loadBanlist();
			void exports.Punishments.loadSharedIps();
		});
	}

	// punishments.tsv is in the format:
	// punishType, userid, ips/usernames, expiration time, reason
	// room-punishments.tsv is in the format:
	// punishType, roomid:userid, ips/usernames, expiration time, reason
	async loadPunishments() {
		const data = await _fs.FS.call(void 0, PUNISHMENT_FILE).readIfExists();
		if (!data) return;
		for (const row of data.split("\n")) {
			if (!row || row === '\r') continue;
			const [punishType, id, altKeys, expireTimeStr, ...reason] = row.trim().split("\t");
			const expireTime = Number(expireTimeStr);
			if (punishType === "Punishment") continue;
			const keys = altKeys.split(',').concat(id);

			const punishment = [punishType, id, expireTime, ...reason] ;
			if (Date.now() >= expireTime) {
				continue;
			}
			for (const key of keys) {
				if (!USERID_REGEX.test(key)) {
					exports.Punishments.ips.set(key, punishment);
				} else {
					exports.Punishments.userids.set(key, punishment);
				}
			}
		}
	}

	async loadRoomPunishments() {
		const data = await _fs.FS.call(void 0, ROOM_PUNISHMENT_FILE).readIfExists();
		if (!data) return;
		for (const row of data.split("\n")) {
			if (!row || row === '\r') continue;
			const [punishType, id, altKeys, expireTimeStr, ...reason] = row.trim().split("\t");
			const expireTime = Number(expireTimeStr);
			if (punishType === "Punishment") continue;
			const [roomid, userid] = id.split(':');
			if (!userid) continue; // invalid format
			const keys = altKeys.split(',').concat(userid);

			const punishment = [punishType, userid, expireTime, ...reason] ;
			if (Date.now() >= expireTime) {
				continue;
			}
			for (const key of keys) {
				if (!USERID_REGEX.test(key)) {
					exports.Punishments.roomIps.nestedSet(roomid , key, punishment);
				} else {
					exports.Punishments.roomUserids.nestedSet(roomid , key, punishment);
				}
			}
		}
	}

	savePunishments() {
		_fs.FS.call(void 0, PUNISHMENT_FILE).writeUpdate(() => {
			const saveTable = exports.Punishments.getPunishments();
			let buf = 'Punishment\tUser ID\tIPs and alts\tExpires\tReason\r\n';
			for (const [id, entry] of saveTable) {
				buf += exports.Punishments.renderEntry(entry, id);
			}
			return buf;
		});
	}

	saveRoomPunishments() {
		_fs.FS.call(void 0, ROOM_PUNISHMENT_FILE).writeUpdate(() => {
			const saveTable = new Map();
			for (const roomid of exports.Punishments.roomIps.keys()) {
				for (const [userid, punishment] of exports.Punishments.getPunishments(roomid, true)) {
					saveTable.set(`${roomid}:${userid}`, punishment);
				}
			}
			let buf = 'Punishment\tRoom ID:User ID\tIPs and alts\tExpires\tReason\r\n';
			for (const [id, entry] of saveTable) {
				buf += exports.Punishments.renderEntry(entry, id);
			}
			return buf;
		});
	}

	getEntry(entryId) {
		let entry = null;
		exports.Punishments.ips.forEach((punishment, ip) => {
			const [punishType, id, expireTime, reason, ...rest] = punishment;
			if (id !== entryId) return;
			if (entry) {
				entry.ips.push(ip);
				return;
			}

			entry = {
				userids: [],
				ips: [ip],
				punishType,
				expireTime,
				reason,
				rest,
			};
		});
		exports.Punishments.userids.forEach((punishment, userid) => {
			const [punishType, id, expireTime, reason, ...rest] = punishment;
			if (id !== entryId) return;

			if (!entry) {
				entry = {
					userids: [],
					ips: [],
					punishType,
					expireTime,
					reason,
					rest,
				};
			}

			if (userid !== id) entry.userids.push(toID(userid));
		});

		return entry;
	}

	appendPunishment(entry, id, filename) {
		if (id.charAt(0) === '#') return;
		const buf = exports.Punishments.renderEntry(entry, id);
		return _fs.FS.call(void 0, filename).append(buf);
	}

	renderEntry(entry, id) {
		const keys = entry.ips.concat(entry.userids).join(',');
		const row = [entry.punishType, id, keys, entry.expireTime, entry.reason, ...entry.rest];
		return row.join('\t') + '\r\n';
	}

	async loadBanlist() {
		const data = await _fs.FS.call(void 0, 'config/ipbans.txt').readIfExists();
		if (!data) return;
		const rangebans = [];
		for (const row of data.split("\n")) {
			const ip = row.split('#')[0].trim();
			if (!ip) continue;
			if (ip.includes('/')) {
				rangebans.push(ip);
			} else if (!exports.Punishments.ips.has(ip)) {
				exports.Punishments.ips.set(ip, ['LOCK', '#ipban', Infinity, '']);
			}
		}
		exports.Punishments.checkRangeBanned = IPTools.checker(rangebans);
	}

	/**
	 * sharedips.tsv is in the format:
	 * IP, type (in this case always SHARED), note
	 */
	async loadSharedIps() {
		const data = await _fs.FS.call(void 0, SHAREDIPS_FILE).readIfExists();
		if (!data) return;
		for (const row of data.split("\n")) {
			if (!row || row === '\r') continue;
			const [ip, type, note] = row.trim().split("\t");
			if (!ip.includes('.')) continue;
			if (type !== 'SHARED') continue;

			exports.Punishments.sharedIps.set(ip, note);
		}
	}

	appendSharedIp(ip, note) {
		const buf = `${ip}\tSHARED\t${note}\r\n`;
		return _fs.FS.call(void 0, SHAREDIPS_FILE).append(buf);
	}

	saveSharedIps() {
		let buf = 'IP\tType\tNote\r\n';
		exports.Punishments.sharedIps.forEach((note, ip) => {
			buf += `${ip}\tSHARED\t${note}\r\n`;
		});

		return _fs.FS.call(void 0, SHAREDIPS_FILE).write(buf);
	}

	/*********************************************************
	 * Adding and removing
	 *********************************************************/

	punish(user, punishment, ignoreAlts) {
		if (typeof user === 'string') return exports.Punishments.punishName(user, punishment);

		const userids = new Set();
		const ips = new Set();
		const affected = ignoreAlts ? [user ] : (user ).getAltUsers(PUNISH_TRUSTED, true);
		for (const alt of affected) {
			this.punishInner(alt, punishment, userids, ips);
		}

		const [punishType, id, expireTime, reason, ...rest] = punishment;
		userids.delete(id );
		exports.Punishments.appendPunishment({
			userids: [...userids],
			ips: [...ips],
			punishType,
			expireTime,
			reason,
			rest,
		}, id, PUNISHMENT_FILE);
		return affected;
	}

	punishInner(user, punishment, userids, ips) {
		const existingPunishment = exports.Punishments.userids.get(user.locked || toID(user.name));
		if (existingPunishment) {
			// don't reduce the duration of an existing punishment
			if (existingPunishment[2] > punishment[2]) {
				punishment[2] = existingPunishment[2];
			}

			// don't override stronger punishment types
			const types = ['LOCK', 'NAMELOCK', 'BAN'];
			if (types.indexOf(existingPunishment[0]) > types.indexOf(punishment[0])) {
				punishment[0] = existingPunishment[0];
			}
		}

		for (const ip in user.ips) {
			exports.Punishments.ips.set(ip, punishment);
			ips.add(ip);
		}
		const lastUserId = user.getLastId();
		if (!lastUserId.startsWith('guest')) {
			exports.Punishments.userids.set(lastUserId, punishment);
		}
		if (user.locked && user.locked.charAt(0) !== '#') {
			exports.Punishments.userids.set(user.locked, punishment);
			userids.add(user.locked );
		}
		if (user.autoconfirmed) {
			exports.Punishments.userids.set(user.autoconfirmed, punishment);
			userids.add(user.autoconfirmed);
		}
		if (user.trusted) {
			exports.Punishments.userids.set(user.trusted, punishment);
			userids.add(user.trusted);
		}
	}

	punishName(userid, punishment) {
		const foundKeys = exports.Punishments.search(userid).map(([key]) => key);
		const userids = new Set([userid]);
		const ips = new Set();
		for (const key of foundKeys) {
			if (key.includes('.')) {
				ips.add(key);
			} else {
				userids.add(key );
			}
		}
		for (const id of userids) {
			exports.Punishments.userids.set(id, punishment);
		}
		for (const ip of ips) {
			exports.Punishments.ips.set(ip, punishment);
		}
		const [punishType, id, expireTime, reason, ...rest] = punishment;
		const affected = Users.findUsers([...userids], [...ips], {includeTrusted: PUNISH_TRUSTED, forPunishment: true});
		userids.delete(id );
		exports.Punishments.appendPunishment({
			userids: [...userids],
			ips: [...ips],
			punishType,
			expireTime,
			reason,
			rest,
		}, id, PUNISHMENT_FILE);

		return affected;
	}

	unpunish(id, punishType) {
		id = toID(id);
		const punishment = exports.Punishments.userids.get(id);
		if (punishment) {
			id = punishment[1];
		}
		// in theory we can stop here if punishment doesn't exist, but
		// in case of inconsistent state, we'll try anyway

		let success = false;
		exports.Punishments.ips.forEach(([curPunishmentType, curId], key) => {
			if (curId === id && curPunishmentType === punishType) {
				exports.Punishments.ips.delete(key);
				success = id;
			}
		});
		exports.Punishments.userids.forEach(([curPunishmentType, curId], key) => {
			if (curId === id && curPunishmentType === punishType) {
				exports.Punishments.userids.delete(key);
				success = id;
			}
		});
		if (success) {
			exports.Punishments.savePunishments();
		}
		return success;
	}

	roomPunish(room, user, punishment) {
		const roomid = typeof room !== 'string' ? (room ).roomid : room;
		const userids = new Set();
		const ips = new Set();
		const affected = user.getAltUsers(PUNISH_TRUSTED, true);
		for (const curUser of affected) {
			this.roomPunishInner(roomid, curUser, punishment, userids, ips);
		}

		const [punishType, id, expireTime, reason, ...rest] = punishment;
		userids.delete(id );
		exports.Punishments.appendPunishment({
			userids: [...userids],
			ips: [...ips],
			punishType,
			expireTime,
			reason,
			rest,
		}, roomid + ':' + id, ROOM_PUNISHMENT_FILE);

		if (typeof room !== 'string' && !((room ).isPrivate === true ||
			(room ).isPersonal || (room ).battle)) {
			exports.Punishments.monitorRoomPunishments(user);
		}

		return affected;
	}

	roomPunishInner(roomid, user, punishment, userids, ips) {
		for (const ip in user.ips) {
			exports.Punishments.roomIps.nestedSet(roomid, ip, punishment);
			ips.add(ip);
		}
		if (!user.id.startsWith('guest')) {
			exports.Punishments.roomUserids.nestedSet(roomid, user.id, punishment);
		}
		if (user.autoconfirmed) {
			exports.Punishments.roomUserids.nestedSet(roomid, user.autoconfirmed, punishment);
			userids.add(user.autoconfirmed);
		}
		if (user.trusted) {
			exports.Punishments.roomUserids.nestedSet(roomid, user.trusted, punishment);
			userids.add(user.trusted);
		}
	}

	roomPunishName(room, userid, punishment) {
		const foundKeys = exports.Punishments.search(userid).map(([key]) => key);
		const userids = new Set([userid]);
		const ips = new Set();
		for (const key of foundKeys) {
			if (key.includes('.')) {
				ips.add(key);
			} else {
				userids.add(key );
			}
		}
		for (const id of userids) {
			exports.Punishments.roomUserids.nestedSet(room.roomid, id, punishment);
		}
		for (const ip of ips) {
			exports.Punishments.roomIps.nestedSet(room.roomid, ip, punishment);
		}
		const [punishType, id, expireTime, reason, ...rest] = punishment;
		const affected = Users.findUsers([...userids], [...ips], {includeTrusted: PUNISH_TRUSTED, forPunishment: true});
		userids.delete(id );
		exports.Punishments.appendPunishment({
			userids: [...userids],
			ips: [...ips],
			punishType,
			expireTime,
			reason,
			rest,
		}, room.roomid + ':' + id, ROOM_PUNISHMENT_FILE);

		if (!(room.isPrivate === true || room.isPersonal || room.battle)) exports.Punishments.monitorRoomPunishments(userid);
		return affected;
	}

	/**
	 * @param ignoreWrite skip persistent storage
	 */
	roomUnpunish(room, id, punishType, ignoreWrite = false) {
		const roomid = typeof room !== 'string' ? (room ).roomid : room;
		id = toID(id);
		const punishment = exports.Punishments.roomUserids.nestedGet(roomid, id);
		if (punishment) {
			id = punishment[1];
		}
		// in theory we can stop here if punishment doesn't exist, but
		// in case of inconsistent state, we'll try anyway

		let success;
		const ipSubMap = exports.Punishments.roomIps.get(roomid);
		if (ipSubMap) {
			for (const [key, [curPunishmentType, curId]] of ipSubMap) {
				if (curId === id && curPunishmentType === punishType) {
					ipSubMap.delete(key);
					success = id;
				}
			}
		}
		const useridSubMap = exports.Punishments.roomUserids.get(roomid);
		if (useridSubMap) {
			for (const [key, [curPunishmentType, curId]] of useridSubMap) {
				if (curId === id && curPunishmentType === punishType) {
					useridSubMap.delete(key);
					success = id;
				}
			}
		}
		if (success && !ignoreWrite) {
			exports.Punishments.saveRoomPunishments();
		}
		return success;
	}

	/*********************************************************
	 * Specific punishments
	 *********************************************************/

	ban(user, expireTime, id, ignoreAlts, ...reason) {
		if (!id) id = user.getLastId();

		if (!expireTime) expireTime = Date.now() + GLOBALBAN_DURATION;
		const punishment = ['BAN', id, expireTime, ...reason] ;

		const affected = exports.Punishments.punish(user, punishment, ignoreAlts);
		for (const curUser of affected) {
			curUser.locked = id;
			curUser.disconnectAll();
		}

		return affected;
	}
	unban(name) {
		return exports.Punishments.unpunish(name, 'BAN');
	}
	lock(userOrUsername, expireTime, id, ignoreAlts, ...reason) {
		const user = (typeof userOrUsername === 'string' ? Users.get(userOrUsername) : userOrUsername);
		if (!id) id = user ? user.getLastId() : toID(userOrUsername);

		if (!expireTime) expireTime = Date.now() + LOCK_DURATION;
		const punishment = ['LOCK', id, expireTime, ...reason] ;

		let affected;

		if (user) {
			affected = exports.Punishments.punish(user, punishment, ignoreAlts);
		} else {
			affected = exports.Punishments.punish(id, punishment, ignoreAlts);
		}

		for (const curUser of affected) {
			curUser.locked = id;
			curUser.updateIdentity();
		}

		return affected;
	}
	autolock(
		user,
		room,
		source,
		reason,
		message,
		week = false,
		namelock
	) {
		if (!message) message = reason;

		let punishment = `LOCKED`;
		let expires = null;
		if (week) {
			expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
			punishment = `WEEKLOCKED`;
		}

		const userid = toID(user);
		const name = typeof user === 'string' ? user : (user ).name;
		if (namelock) {
			punishment = `NAMELOCKED`;
			exports.Punishments.namelock(user, expires, toID(namelock), false, `Autonamelock: ${name}: ${reason}`);
		} else {
			exports.Punishments.lock(user, expires, toID(user), false, `Autolock: ${name}: ${reason}`);
		}
		Monitor.log(`[${source}] ${punishment}: ${message}`);
		const roomauth = Rooms.global.destroyPersonalRooms(userid);
		// tslint:disable-next-line: max-line-length
		if (roomauth.length) Monitor.log(`[CrisisMonitor] Autolocked user ${name} has public roomauth (${roomauth.join(', ')}), and should probably be demoted.`);

		const ipStr = typeof user !== 'string' ? ` [${(user ).latestIp}]` : '';
		const roomid = typeof room !== 'string' ? (room ).roomid : room;
		Rooms.global.modlog(`(${roomid}) AUTO${namelock ? `NAME` : ''}LOCK: [${userid}]${ipStr}: ${reason}`);

		const roomObject = Rooms.get(room);
		const userObject = Users.get(user);
		if (roomObject && roomObject.battle && userObject && userObject.connections[0]) {
			Chat.parse('/savereplay forpunishment', roomObject, userObject, userObject.connections[0]);
		}
	}
	unlock(name) {
		const user = Users.get(name);
		let id = toID(name);
		const success = [];
		if (user && user.locked && !user.namelocked) {
			id = user.locked;
			user.locked = null;
			user.namelocked = null;
			user.updateIdentity();
			success.push(user.getLastName());
		}
		if (id.charAt(0) !== '#') {
			for (const curUser of Users.users.values()) {
				if (curUser.locked === id) {
					curUser.locked = null;
					curUser.namelocked = null;
					curUser.updateIdentity();
					success.push(curUser.getLastName());
				}
			}
		}
		if (exports.Punishments.unpunish(name, 'LOCK')) {
			if (!success.length) success.push(name);
		}
		if (!success.length) return undefined;
		if (!success.some(v => toID(v) === id)) {
			success.push(id);
		}
		return success;
	}
	namelock(user, expireTime, id, ignoreAlts, ...reason) {
		if (!id) id = typeof user === 'string' ? toID(user) : (user ).getLastId();

		if (!expireTime) expireTime = Date.now() + LOCK_DURATION;
		const punishment = ['NAMELOCK', id, expireTime, ...reason] ;

		const affected = exports.Punishments.punish(user, punishment, ignoreAlts);
		for (const curUser of affected) {
			curUser.locked = id;
			curUser.namelocked = id;
			curUser.resetName(true);
			curUser.updateIdentity();
		}

		return affected;
	}
	unnamelock(name) {
		const user = Users.get(name);
		let id = toID(name);
		const success = [];
		if (user && user.namelocked) name = user.namelocked;

		const unpunished = exports.Punishments.unpunish(name, 'NAMELOCK');
		if (user && user.locked) {
			id = user.locked;
			user.locked = null;
			user.namelocked = null;
			user.resetName();
			success.push(user.getLastName());
		}
		if (id.charAt(0) !== '#') {
			for (const curUser of Users.users.values()) {
				if (curUser.locked === id) {
					curUser.locked = null;
					curUser.namelocked = null;
					curUser.resetName();
					success.push(curUser.getLastName());
				}
			}
		}
		if (unpunished && !success.length) success.push(name);
		if (!success.length) return false;
		if (!success.some(v => toID(v) === id)) {
			success.push(id);
		}
		return success;
	}
	battleban(user, expireTime, id, ...reason) {
		if (!id) id = user.getLastId();

		if (!expireTime) expireTime = Date.now() + BATTLEBAN_DURATION;
		const punishment = ['BATTLEBAN', id, expireTime, ...reason] ;

		// Handle tournaments the user was in before being battle banned
		for (const games of user.games.keys()) {
			const game = Rooms.get(games).game;
			if (!game) continue; // this should never happen
			if ((game ).isTournament) {
				if ((game ).isTournamentStarted) {
					(game ).disqualifyUser(id, null, null);
				} else if (!(game ).isTournamentStarted) {
					(game ).removeUser(user.id);
				}
			}
		}

		return exports.Punishments.roomPunish("battle" , user, punishment);
	}
	unbattleban(userid) {
		const user = Users.get(userid);
		if (user) {
			const punishment = exports.Punishments.isBattleBanned(user);
			if (punishment) userid = punishment[1];
		}
		return exports.Punishments.roomUnpunish("battle" , userid, 'BATTLEBAN');
	}
	isBattleBanned(user) {
		if (!user) throw new Error(`Trying to check if a non-existent user is battlebanned.`);

		let punishment = exports.Punishments.roomUserids.nestedGet("battle" , user.id);
		if (punishment && punishment[0] === 'BATTLEBAN') return punishment;

		if (user.autoconfirmed) {
			punishment = exports.Punishments.roomUserids.nestedGet("battle" , user.autoconfirmed);
			if (punishment && punishment[0] === 'BATTLEBAN') return punishment;
		}

		for (const ip in user.ips) {
			punishment = exports.Punishments.roomIps.nestedGet("battle" , ip);
			if (punishment && punishment[0] === 'BATTLEBAN') {
				if (exports.Punishments.sharedIps.has(ip) && user.autoconfirmed) return;
				return punishment;
			}
		}
	}

	lockRange(range, reason) {
		const punishment = ['LOCK', '#rangelock', Date.now() + RANGELOCK_DURATION, reason] ;
		exports.Punishments.ips.set(range, punishment);
	}
	banRange(range, reason) {
		const punishment = ['BAN', '#rangelock', Date.now() + RANGELOCK_DURATION, reason] ;
		exports.Punishments.ips.set(range, punishment);
	}

	roomBan(room, user, expireTime, userId, ...reason) {
		if (!userId) userId = user.getLastId();

		if (!expireTime) expireTime = Date.now() + ROOMBAN_DURATION;
		const punishment = ['ROOMBAN', userId, expireTime, ...reason] ;

		const affected = exports.Punishments.roomPunish(room, user, punishment);
		for (const curUser of affected) {
			if (room.game && room.game.removeBannedUser) {
				room.game.removeBannedUser(curUser);
			}
			curUser.leaveRoom(room.roomid);
		}

		if (room.subRooms) {
			for (const subRoom of room.subRooms.values()) {
				for (const curUser of affected) {
					if (subRoom.game && subRoom.game.removeBannedUser) {
						subRoom.game.removeBannedUser(curUser);
					}
					curUser.leaveRoom(subRoom.roomid);
				}
			}
		}

		return affected;
	}

	roomBlacklist(room, user, expireTime, userId, ...reason) {
		if (!userId && user) userId = user.getLastId();
		if (!user) user = Users.get(userId);

		if (!expireTime) expireTime = Date.now() + BLACKLIST_DURATION;
		const punishment = ['BLACKLIST', userId, expireTime, ...reason] ;

		let affected = [];

		if (!user || userId && userId !== user.id) {
			affected = exports.Punishments.roomPunishName(room, userId, punishment);
		}

		if (user) {
			affected = affected.concat(exports.Punishments.roomPunish(room, user, punishment));
		}

		for (const curUser of affected) {
			if (room.game && room.game.removeBannedUser) {
				room.game.removeBannedUser(curUser);
			}
			curUser.leaveRoom(room.roomid);
		}

		if (room.subRooms) {
			for (const subRoom of room.subRooms.values()) {
				for (const curUser of affected) {
					if (subRoom.game && subRoom.game.removeBannedUser) {
						subRoom.game.removeBannedUser(curUser);
					}
					curUser.leaveRoom(subRoom.roomid);
				}
			}
		}

		return affected;
	}

	roomUnban(room, userid) {
		const user = Users.get(userid);
		if (user) {
			const punishment = exports.Punishments.isRoomBanned(user, room.roomid);
			if (punishment) userid = punishment[1];
		}
		return exports.Punishments.roomUnpunish(room, userid, 'ROOMBAN');
	}

	/**
	 * @param ignoreWrite Flag to skip persistent storage.
	 */
	roomUnblacklist(room, userid, ignoreWrite) {
		const user = Users.get(userid);
		if (user) {
			const punishment = exports.Punishments.isRoomBanned(user, room.roomid);
			if (punishment) userid = punishment[1];
		}
		return exports.Punishments.roomUnpunish(room, userid, 'BLACKLIST', ignoreWrite);
	}

	roomUnblacklistAll(room) {
		const roombans = exports.Punishments.roomUserids.get(room.roomid);
		if (!roombans) return false;

		const unblacklisted = [];

		roombans.forEach(([punishType], userid) => {
			if (punishType === 'BLACKLIST') {
				exports.Punishments.roomUnblacklist(room, userid, true);
				unblacklisted.push(userid);
			}
		});
		if (unblacklisted.length === 0) return false;
		exports.Punishments.saveRoomPunishments();
		return unblacklisted;
	}

	addSharedIp(ip, note) {
		exports.Punishments.sharedIps.set(ip, note);
		void exports.Punishments.appendSharedIp(ip, note);

		for (const user of Users.users.values()) {
			if (user.locked && user.locked !== user.id && ip in user.ips) {
				if (!user.autoconfirmed) {
					user.semilocked = `#sharedip ${user.locked}`;
				}
				user.locked = null;
				user.namelocked = null;

				user.updateIdentity();
			}
		}
	}

	removeSharedIp(ip) {
		exports.Punishments.sharedIps.delete(ip);
		void exports.Punishments.saveSharedIps();
	}

	/*********************************************************
	 * Checking
	 *********************************************************/

	/**
	 * Returns an array of [key, roomid, punishment] pairs.
	 *
	 * @param searchId userid or IP
	 */
	search(searchId) {
		/** [key, roomid, punishment][] */
		const results = [];
		exports.Punishments.ips.forEach((punishment, ip) => {
			const [, id] = punishment;

			if (searchId === id || searchId === ip) {
				results.push([ip, '' , punishment]);
			}
		});
		exports.Punishments.userids.forEach((punishment, userid) => {
			const [, id] = punishment;

			if (searchId === id || searchId === userid) {
				results.push([userid, '' , punishment]);
			}
		});
		exports.Punishments.roomIps.nestedForEach((punishment, roomid, ip) => {
			const [, punishUserid] = punishment;

			if (searchId === punishUserid || searchId === ip) {
				results.push([ip, roomid, punishment]);
			}
		});
		exports.Punishments.roomUserids.nestedForEach((punishment, roomid, userid) => {
			const [, punishUserid] = punishment;

			if (searchId === punishUserid || searchId === userid) {
				results.push([userid, roomid, punishment]);
			}
		});

		return results;
	}

	getPunishType(name) {
		let punishment = exports.Punishments.userids.get(toID(name));
		if (punishment) return punishment[0];
		const user = Users.get(name);
		if (!user) return;
		punishment = exports.Punishments.ipSearch(user.latestIp);
		if (punishment) return punishment[0];
		return '';
	}

	getRoomPunishType(room, name) {
		let punishment = exports.Punishments.roomUserids.nestedGet(room.roomid, toID(name));
		if (punishment) return punishment[0];
		const user = Users.get(name);
		if (!user) return;
		punishment = exports.Punishments.roomIps.nestedGet(room.roomid, user.latestIp);
		if (punishment) return punishment[0];
		return '';
	}

	/**
	 * Searches for IP in Punishments.ips
	 *
	 * For instance, if IP is '1.2.3.4', will return the value corresponding
	 * to any of the keys in table match '1.2.3.4', '1.2.3.*', '1.2.*', or '1.*'
	 *
	 */
	ipSearch(ip) {
		let punishment = exports.Punishments.ips.get(ip);
		if (punishment) return punishment;
		let dotIndex = ip.lastIndexOf('.');
		for (let i = 0; i < 4 && dotIndex > 0; i++) {
			ip = ip.substr(0, dotIndex);
			punishment = exports.Punishments.ips.get(ip + '.*');
			if (punishment) return punishment;
			dotIndex = ip.lastIndexOf('.');
		}
		return undefined;
	}

	/**
	 * @deprecated
	 */
	shortenHost(host) {
		if (host.slice(-7) === '-nohost') return host;
		let dotLoc = host.lastIndexOf('.');
		const tld = host.substr(dotLoc);
		if (tld === '.uk' || tld === '.au' || tld === '.br') dotLoc = host.lastIndexOf('.', dotLoc - 1);
		dotLoc = host.lastIndexOf('.', dotLoc - 1);
		return host.substr(dotLoc + 1);
	}

	/** Defined in Punishments.loadBanlist */
	checkRangeBanned(ip) {
		return false;
	}

	checkName(user, userid, registered) {
		if (userid.startsWith('guest')) return;
		for (const roomid of user.inRooms) {
			exports.Punishments.checkNewNameInRoom(user, userid, roomid);
		}
		let punishment = exports.Punishments.userids.get(userid);
		const battleban = exports.Punishments.isBattleBanned(user);
		if (!punishment && user.namelocked) {
			punishment = exports.Punishments.userids.get(user.namelocked);
			if (!punishment) punishment = ['NAMELOCK', user.namelocked, 0, ''];
		}
		if (!punishment && user.locked) {
			punishment = exports.Punishments.userids.get(user.locked);
			if (!punishment) punishment = ['LOCK', user.locked, 0, ''];
		}

		const ticket = Chat.pages.help
			? `<a href="view-help-request--appeal"><button class="button"><strong>Appeal your punishment</strong></button></a>`
			: '';

		if (battleban) {
			if (battleban[1] !== user.id && exports.Punishments.sharedIps.has(user.latestIp) && user.autoconfirmed) {
				exports.Punishments.roomUnpunish("battle" , userid, 'BATTLEBAN');
			} else {
				exports.Punishments.roomPunish("battle" , user, battleban);
				user.cancelReady();
				if (!punishment) {
					const appealLink = ticket || (Config.appealurl ? `appeal at: ${Config.appealurl}` : ``);
					// Prioritize popups for other global punishments
					user.send(`|popup||html|You are banned from battling${battleban[1] !== userid ? ` because you have the same IP as banned user: ${battleban[1]}` : ''}. Your battle ban will expire in a few days.${battleban[3] ? Chat.html `\n\nReason: ${battleban[3]}` : ``}${appealLink ? `\n\nOr you can ${appealLink}.` : ``}`);
					user.punishmentNotified = true;
					return;
				}
			}
		}
		if (!punishment) return;

		const id = punishment[0];
		const punishUserid = punishment[1];
		const reason = punishment[3] ?  `\n\nReason: ${Chat.escapeHTML(punishment[3])}` : '';
		let appeal = ``;
		if (user.permalocked && Config.appealurl) {
			appeal += `\n\nPermanent punishments can be appealed: <a href="${Config.appealurl}">${Config.appealurl}</a>`;
		} else if (ticket) {
			appeal += `\n\nIf you feel you were unfairly punished or wish to otherwise appeal, you can ${ticket}.`;
		} else if (Config.appealurl) {
			appeal += `\n\nIf you wish to appeal your punishment, please use: <a href="${Config.appealurl}">${Config.appealurl}</a>`;
		}
		const bannedUnder = punishUserid !== userid ? ` because you have the same IP as banned user: ${punishUserid}` : '';

		if ((id === 'LOCK' || id === 'NAMELOCK') && punishUserid !== userid && exports.Punishments.sharedIps.has(user.latestIp)) {
			if (!user.autoconfirmed) {
				user.semilocked = `#sharedip ${user.locked}`;
			}
			user.locked = null;
			user.namelocked = null;

			user.updateIdentity();
			return;
		}
		if (registered && id === 'BAN') {
			user.popup(`Your username (${user.name}) is banned${bannedUnder}. Your ban will expire in a few days.${reason}${Config.appealurl ? `||||Or you can appeal at: ${Config.appealurl}` : ``}`);
			user.punishmentNotified = true;
			exports.Punishments.punish(user, punishment, false);
			user.disconnectAll();
			return;
		}
		if (id === 'NAMELOCK' || user.namelocked) {
			user.send(`|popup||html|You are namelocked and can't have a username${bannedUnder}. Your namelock will expire in a few days.${reason}${appeal}`);
			user.locked = punishUserid;
			user.namelocked = punishUserid;
			user.resetName();
			user.updateIdentity();
		} else {
			if (punishUserid === '#hostfilter') {
				user.popup(`Due to spam, you can't chat using a proxy. (Your IP ${user.latestIp} appears to be a proxy.)`);
			} else if (punishUserid === '#ipban') {
				user.popup(`Your IP (${user.latestIp}) is not allowed to chat on PS, because it has been used to spam, hack, or otherwise attack our server. Make sure you are not using any proxies to connect to PS.`);
			} else if (!user.lockNotified) {
				user.send(`|popup||html|You are locked${bannedUnder}. ${user.permalocked ? `This lock is permanent.` : `Your lock will expire in a few days.`}${reason}${appeal}`);
			}
			user.lockNotified = true;
			user.locked = punishUserid;
			user.updateIdentity();
		}
	}

	checkIp(user, connection) {
		const ip = connection.ip;
		let punishment = exports.Punishments.ipSearch(ip);

		if (!punishment && exports.Punishments.checkRangeBanned(ip)) {
			punishment = ['LOCK', '#ipban', Infinity, ''];
		}

		if (punishment) {
			if (exports.Punishments.sharedIps.has(user.latestIp)) {
				if (!user.locked && !user.autoconfirmed) {
					user.semilocked = `#sharedip ${punishment[1]}`;
				}
			} else {
				user.locked = punishment[1];
				if (punishment[0] === 'NAMELOCK') {
					user.namelocked = punishment[1];
				}
			}
		}

		return IPTools.lookup(ip).then(({dnsbl, host, hostType}) => {
			user = connection.user || user;
			if (user.locked === '#hostfilter') user.locked = null;

			if (hostType === 'proxy' && !user.trusted && !user.locked) {
				user.locked = '#hostfilter';
			} else if (dnsbl && !user.autoconfirmed) {
				user.semilocked = '#dnsbl';
			}
			if (host) {
				user.latestHost = host;
				user.latestHostType = hostType;
			}
			Chat.hostfilter(host || '', user, connection, hostType);
		});
	}

	/**
	 * IP bans need to be checked separately since we don't even want to
	 * make a User object if an IP is banned.
	 */
	checkIpBanned(connection) {
		const ip = connection.ip;
		if (exports.Punishments.cfloods.has(ip) || (Monitor.countConnection(ip) && exports.Punishments.cfloods.add(ip))) {
			connection.send(`|popup||modal|PS is under heavy load and cannot accommodate your connection right now.`);
			return '#cflood';
		}

		if (exports.Punishments.sharedIps.has(ip)) return false;

		let banned = false;
		const punishment = exports.Punishments.ipSearch(ip);
		if (punishment && punishment[0] === 'BAN') {
			banned = punishment[1];
		}
		if (!banned) return false;

		const appeal = (Config.appealurl ? `||||Or you can appeal at: ${Config.appealurl}` : ``);
		connection.send(`|popup||modal|You are banned because you have the same IP (${ip}) as banned user '${banned}'. Your ban will expire in a few days.${appeal}`);
		Monitor.notice(`CONNECT BLOCKED - IP BANNED: ${ip} (${banned})`);

		return banned;
	}

	checkNameInRoom(user, roomid) {
		let punishment = exports.Punishments.roomUserids.nestedGet(roomid, user.id);
		if (!punishment && user.autoconfirmed) {
			punishment = exports.Punishments.roomUserids.nestedGet(roomid, user.autoconfirmed);
		}
		if (punishment && (punishment[0] === 'ROOMBAN' || punishment[0] === 'BLACKLIST')) {
			return true;
		}
		const room = Rooms.get(roomid);
		if (room.parent) {
			return exports.Punishments.checkNameInRoom(user, room.parent.roomid);
		}
		return false;
	}

	/**
	 * @param userid The name into which the user is renamed.
	 */
	checkNewNameInRoom(user, userid, roomid) {
		let punishment = exports.Punishments.roomUserids.nestedGet(roomid, userid) || null;
		if (!punishment) {
			const room = Rooms.get(roomid);
			if (room.parent) {
				punishment = exports.Punishments.checkNewNameInRoom(user, userid, room.parent.roomid);
			}
		}
		if (punishment) {
			if (punishment[0] !== 'ROOMBAN' && punishment[0] !== 'BLACKLIST') return null;
			const room = Rooms.get(roomid);
			if (room.game && room.game.removeBannedUser) {
				room.game.removeBannedUser(user);
			}
			user.leaveRoom(room.roomid);
			return punishment;
		}
		return null;
	}

	/**
	 * @return Descriptive text for the remaining time until the punishment expires, if any.
	 */
	checkLockExpiration(userid) {
		if (!userid) return ``;
		const punishment = exports.Punishments.userids.get(userid);

		if (punishment) {
			const user = Users.get(userid);
			if (user && user.permalocked) return ` (never expires; you are permalocked)`;
			const expiresIn = new Date(punishment[2]).getTime() - Date.now();
			const expiresDays = Math.round(expiresIn / 1000 / 60 / 60 / 24);
			let expiresText = '';
			if (expiresDays >= 1) {
				expiresText = `in around ${Chat.count(expiresDays, "days")}`;
			} else {
				expiresText = `soon`;
			}
			if (expiresIn > 1) return ` (expires ${expiresText})`;
		}

		return ``;
	}

	isRoomBanned(user, roomid) {
		if (!user) throw new Error(`Trying to check if a non-existent user is room banned.`);

		let punishment = exports.Punishments.roomUserids.nestedGet(roomid, user.id);
		if (punishment && (punishment[0] === 'ROOMBAN' || punishment[0] === 'BLACKLIST')) return punishment;

		if (user.autoconfirmed) {
			punishment = exports.Punishments.roomUserids.nestedGet(roomid, user.autoconfirmed);
			if (punishment && (punishment[0] === 'ROOMBAN' || punishment[0] === 'BLACKLIST')) return punishment;
		}

		for (const ip in user.ips) {
			punishment = exports.Punishments.roomIps.nestedGet(roomid, ip);
			if (punishment) {
				if (punishment[0] === 'ROOMBAN') {
					return punishment;
				} else if (punishment[0] === 'BLACKLIST') {
					if (exports.Punishments.sharedIps.has(ip) && user.autoconfirmed) return;

					return punishment;
				}
			}
		}

		const room = Rooms.get(roomid);
		if (!room) throw new Error(`Trying to ban a user from a nonexistent room: ${roomid}`);

		if (room.parent) return exports.Punishments.isRoomBanned(user, room.parent.roomid);
	}

	/**
	 * Returns an array of all room punishments associated with a user.
	 *
	 * options.publicOnly will make this only return public room punishments.
	 * options.checkIps will also check the IP of the user for IP-based punishments.
	 */
	getRoomPunishments(user, options = {}) {
		if (!user) return [];
		const userid = toID(user);
		const checkMutes = typeof user !== 'string';

		const punishments = [];

		for (const curRoom of Rooms.global.chatRooms) {
			if (!curRoom
				|| curRoom.isPrivate === true
				|| (options.publicOnly
					&& (curRoom.isPersonal || curRoom.battle))) continue;
			let punishment = exports.Punishments.roomUserids.nestedGet(curRoom.roomid, userid);
			if (punishment) {
				punishments.push([curRoom, punishment]);
				continue;
			} else if (options && options.checkIps) {
				if (typeof user !== 'string') {
					for (const ip in user.ips) {
						punishment = exports.Punishments.roomIps.nestedGet(curRoom.roomid, ip);
						if (punishment) {
							punishments.push([curRoom, punishment]);
							continue;
						}
					}
				}
			}
			if (checkMutes && curRoom.muteQueue) {
				for (const entry of curRoom.muteQueue) {
					// checkMutes guarantees user is a User
					if (userid === entry.userid ||
						(user ).guestNum === entry.guestNum ||
						((user ).autoconfirmed && (user ).autoconfirmed === entry.autoconfirmed)) {
						punishments.push([curRoom, ['MUTE', entry.userid, entry.time, ''] ]);
					}
				}
			}
		}

		return punishments;
	}
	getPunishments(roomid, ignoreMutes) {
		const punishmentTable = new Map();
		if (roomid && (!exports.Punishments.roomIps.has(roomid) || !exports.Punishments.roomUserids.has(roomid))) return punishmentTable;
		// `Punishments.roomIps.get(roomid)` guaranteed to exist above
		(roomid ? exports.Punishments.roomIps.get(roomid) : exports.Punishments.ips).forEach((punishment, ip) => {
			const [punishType, id, expireTime, reason, ...rest] = punishment;
			if (id.charAt(0) === '#') return;
			let entry = punishmentTable.get(id);

			if (entry) {
				entry.ips.push(ip);
				return;
			}

			entry = {
				userids: [],
				ips: [ip],
				punishType,
				expireTime,
				reason,
				rest,
			};
			punishmentTable.set(id, entry);
		});
		// `Punishments.roomIps.get(roomid)` guaranteed to exist above
		(roomid ? exports.Punishments.roomUserids.get(roomid) : exports.Punishments.userids).forEach((punishment, userid) => {
			const [punishType, id, expireTime, reason, ...rest] = punishment;
			if (id.charAt(0) === '#') return;
			let entry = punishmentTable.get(id);

			if (!entry) {
				entry = {
					userids: [],
					ips: [],
					punishType,
					expireTime,
					reason,
					rest,
				};
				punishmentTable.set(id, entry);
			}

			if (userid !== id) entry.userids.push(userid ); // guaranteed as per above check
		});
		if (roomid && ignoreMutes !== false) {
			const room = Rooms.get(roomid);
			if (room && room.muteQueue) {
				for (const mute of room.muteQueue) {
					punishmentTable.set(mute.userid, {
						userids: [], ips: [], punishType: "MUTE", expireTime: mute.time, reason: "", rest: [],
					});
				}
			}
		}
		return punishmentTable;
	}
	visualizePunishments(punishments, user) {
		let buf = "";
		buf += `<div class="ladder pad"><h2>List of active punishments:</h2>`;
		buf += `<table">`;
		buf += `<tr>`;
		buf += `<th>Username</th>`;
		buf += `<th>Punishment type</th>`;
		buf += `<th>Expire time</th>`;
		buf += `<th>Reason</th>`;
		buf += `<th>Alts</th>`;
		if (user.can('ban')) buf += `<th>IPs</th>`;
		buf += `</tr>`;
		for (const [userid, punishment] of punishments) {
			const expiresIn = new Date(punishment.expireTime).getTime() - Date.now();
			if (expiresIn < 1000) continue;
			const expireString = Chat.toDurationString(expiresIn, {precision: 1});
			buf += `<tr>`;
			buf += `<td>${userid}</td>`;
			buf += `<td>${punishment.punishType}</td>`;
			buf += `<td>${expireString}</td>`;
			buf += `<td>${punishment.reason || ' - '}</td>`;
			buf += `<td>${punishment.userids.join(", ") || ' - '}</td>`;
			if (user.can('ban')) buf += `<td>${punishment.ips.join(", ") || ' - '}</td>`;
			buf += `</tr>`;
		}
		buf += `</table>`;
		buf += `</div>`;
		return buf;
	}
	/**
	 * Notifies staff if a user has three or more room punishments.
	 */
	monitorRoomPunishments(user) {
		if ((user ).locked) return;
		const userid = toID(user);

		/** Default to 3 if the Config option is not defined or valid */
		const minPunishments = (typeof Config.monitorminpunishments === 'number' ? Config.monitorminpunishments : 3);
		if (!minPunishments) return;

		const punishments = exports.Punishments.getRoomPunishments(user, {publicOnly: true});

		if (punishments.length >= minPunishments) {
			let points = 0;

			const punishmentText = punishments.map(([room, punishment]) => {
				const [punishType, punishUserid, , reason] = punishment;
				if (punishType in PUNISHMENT_POINT_VALUES) points += PUNISHMENT_POINT_VALUES[punishType];
				let punishDesc = exports.Punishments.roomPunishmentTypes.get(punishType);
				if (!punishDesc) punishDesc = `punished`;
				if (punishUserid !== userid) punishDesc += ` as ${punishUserid}`;

				if (reason) punishDesc += `: ${reason}`;
				return `<<${room}>> (${punishDesc})`;
			}).join(', ');

			if (Config.punishmentautolock && points >= AUTOLOCK_POINT_THRESHOLD) {
				const rooms = punishments.map(([room]) => room).join(', ');
				const reason = `Autolocked for having punishments in ${punishments.length} rooms: ${rooms}`;
				const message = `${(user ).name || userid} was locked for having punishments in ${punishments.length} rooms: ${punishmentText}`;

				exports.Punishments.autolock(user, 'staff' , 'PunishmentMonitor', reason, message);
				if (typeof user !== 'string') {
					// tslint:disable-next-line: max-line-length
					(user ).popup("|modal|You've been locked for breaking the rules in multiple chatrooms.\n\nIf you feel that your lock was unjustified, you can still PM staff members (%, @, &, and ~) to discuss it" + (Config.appealurl ? " or you can appeal:\n" + Config.appealurl : ".") + "\n\nYour lock will expire in a few days.");
				}
			} else {
				Monitor.log(`[PunishmentMonitor] ${(user ).name || userid} currently has punishments in ${punishments.length} rooms: ${punishmentText}`);
			}
		}
	}
}, _class)(); exports.Punishments = Punishments;
