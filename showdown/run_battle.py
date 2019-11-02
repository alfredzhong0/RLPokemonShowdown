import json
import asyncio
import concurrent.futures
from copy import deepcopy

import constants
import config
from config import logger
from config import reset_logger
from showdown.evaluate import Scoring
from showdown.battle import Battle
from showdown.battle import Pokemon
from showdown.battle_modifier import update_battle
from showdown.engine import find_best_move

from showdown.websocket_client import PSWebsocketClient



import sys
import random
from showdown.model.battle_state import Move, Pokemon, RLBattle


async def _handle_team_preview(battle: Battle, ps_websocket_client: PSWebsocketClient):
    battle_copy = deepcopy(battle)
    battle_copy.user.active = Pokemon.get_dummy()
    battle_copy.opponent.active = Pokemon.get_dummy()

    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        best_move = await loop.run_in_executor(
            pool, find_best_move, battle_copy
        )
    formatted_message = await format_decision(battle, best_move)
    size_of_team = len(battle.user.reserve) + 1
    team_list_indexes = list(range(1, size_of_team))
    choice_digit = int(formatted_message[0].split()[-1])

    team_list_indexes.remove(choice_digit)
    message = ["/team {}{}|{}".format(choice_digit, "".join(str(x) for x in team_list_indexes), battle.rqid)]
    battle.user.active = battle.user.reserve.pop(choice_digit - 1)

    await ps_websocket_client.send_message(battle.battle_tag, message)


async def get_battle_tag_and_opponent(ps_websocket_client: PSWebsocketClient):

    counter = 0
    while True:
        msg = await ps_websocket_client.receive_message()

        counter += 1
        print("A " + str(counter) + " MESSAGE = \n" + msg)

        split_msg = msg.split('|')
        first_msg = split_msg[0]
        if 'battle' in first_msg:
            battle_tag = first_msg.replace('>', '').strip()
            user_name = split_msg[-1].replace('☆', '').strip()
            opponent_name = split_msg[4].replace(user_name, '').replace('vs.', '').strip()
            return battle_tag, opponent_name


async def _initialize_battle_with_tag(ps_websocket_client: PSWebsocketClient):
    battle_tag, opponent_name = await get_battle_tag_and_opponent(ps_websocket_client)

    counter = 0
    while True:
        msg = await ps_websocket_client.receive_message()
        counter += 1
        print("B " + str(counter) + " MESSAGE = \n" + msg)

        split_msg = msg.split('|')
        # if split_msg[1].strip() == 'request' and split_msg[2].strip():
        #     user_json = json.loads(split_msg[2].strip('\''))
        #     user_id = user_json[constants.SIDE][constants.ID]
        #     opponent_id = constants.ID_LOOKUP[user_id]
        #     battle = Battle(battle_tag)
        #     battle.opponent.name = opponent_id
        #     battle.opponent.account_name = opponent_name
        #     return battle, opponent_id, user_json

        if split_msg[1].strip() == 'request' and split_msg[2].strip():
            user_json = json.loads(split_msg[2].strip('\''))
            #battle = RLBattle()

            pokemons = []


            # Get user lineup
            for i in range(6):
               
                pokemon_dict = user_json["side"]["pokemon"][i]

                # Get name of pokemon
                string = pokemon_dict["ident"]
                token = "p1: " # FIX ME!!! might also be p2:
                name = string[string.find(token) + len(token) + 1:]

                # Get level of pokemon
                string = pokemon_dict["details"]
                token = ", L"
                level = int(string[string.find(token) + len(token):])

                # Get health & max hp of pokemon
                string = pokemon_dict["condition"]
                token = "/"
                idx = string.find(token) + len(token)
                health = int(string[:idx-1])
                max_health = int(string[idx+1:])

                # Get stats
                stats = {"atk":0,"def":0,"spa":0,"spd":0,"spe":0}
                stats["atk"] = pokemon_dict["stats"]["atk"]
                stats["def"] = pokemon_dict["stats"]["def"]
                stats["spa"] = pokemon_dict["stats"]["spa"]
                stats["spd"] = pokemon_dict["stats"]["spd"]
                stats["spe"] = pokemon_dict["stats"]["spe"]

                # Get moves
                num_moves = len(pokemon_dict["moves"])# not always 4!
                moves = []
                for j in range(num_moves):
                    mname = pokemon_dict["moves"][j]
                    move = Move(mname,-1,True,"unknown",-1,-1,"unknown")
                    moves.append(move)

                active = pokemon_dict["active"]
                status = "none"

                pokemon = Pokemon(name, i, [], level, max_health, stats, moves, status, active)
                pokemons.append(pokemon)

            for i in range(len(pokemons)):
                pokemon = pokemons[i]
                print(pokemon)
                # print("~~~~~~~~%i~~~~~~~~~" % (i))
                # print("Name = %s" % (pokemon.name))
                # print("Lvl = %s" % (pokemon.level))
                # for j in range(len(pokemon.moves)):
                #     print(pokemon.moves[j])

            # Populate enemy lineup (empty template until more information is reveal)
            enemy_pokemons = []
            for i in range(6):
                stats = {"atk":0,"def":0,"spa":0,"spd":0,"spe":0}
                moves = []
                for j in range(4): # might not necessarily have 4 moves
                    move = Move("",-1,True,"unknown",-1,-1,"unknown")
                    moves.append(move)
                pokemon = Pokemon("", i, [], -1, 100, stats, moves, "none", False)
                enemy_pokemons.append(pokemon)

            battle = RLBattle(pokemons, enemy_pokemons)
            battle.battle_tag = battle_tag
            battle.opponent_name = opponent_name
            parse_message(battle, msg)

            return battle


async def _start_random_battle(ps_websocket_client: PSWebsocketClient):
    battle = await _initialize_battle_with_tag(ps_websocket_client)
    counter = 0
    while True:
        msg = await ps_websocket_client.receive_message()
        counter += 1
        print("C " + str(counter) + " MESSAGE = \n" + msg)
        if constants.START_STRING in msg:
            return battle




async def format_decision(battle, decision):
    if decision.startswith(constants.SWITCH_STRING) and decision != "switcheroo":
        switch_pokemon = decision.split("switch ")[-1]
        for pkmn in battle.user.reserve:
            if pkmn.name == switch_pokemon:
                message = "/switch {}".format(pkmn.index)
                break
        else:
            raise ValueError("Tried to switch to: {}".format(switch_pokemon))
    else:
        message = "/choose move {}".format(decision)
        if battle.user.active.can_mega_evo:
            message = "{} {}".format(message, constants.MEGA)
        elif battle.user.active.can_ultra_burst:
            message = "{} {}".format(message, constants.ULTRA_BURST)

        if battle.user.active.get_move(decision).can_z:
            message = "{} {}".format(message, constants.ZMOVE)

    return [message, str(battle.rqid)]


def parse_message(battle, msg):

    print("parse_message")
    if ('|request|' in msg):

        # Reset possible moves
        battle.wait = False
        battle.force_switch = False
        battle.available_moves = []
        battle.available_switches = []

        split_msg = msg.split('|')
        user_json = json.loads(split_msg[2].strip('\''))

        if (("wait" in user_json) and user_json["wait"]): # i.e. when pokemon faints
            battle.wait = True
        elif (("forceSwitch" in user_json) and user_json["forceSwitch"]): # i.e. when pokemon faints
            battle.force_switch = True
        else:
            available_moves = user_json["active"][0]["moves"]
            trapped = "trapped" in user_json["active"][0] # special case where only one move is allowed
            
            if (trapped):
                move = available_moves[0] # only one move available to use
                battle.available_moves.append(move["id"])
            elif (available_moves[0]["id"] == "recharge"): # previous case should handle this, but sometimes server doesn't output "trapped" key
                battle.available_moves.append("recharge")
            else:
                for i in range(len(available_moves)):
                    move = available_moves[i]
                    if (move["disabled"] == False):
                        battle.available_moves.append(move["id"])
                    print("available move: " + move["id"])

        pokemons = user_json["side"]["pokemon"]
        for i in range(6):
            pokemon = pokemons[i]
            if ("fnt" not in pokemon["condition"]): # can only switch to unfainted pokemon
                
                string = pokemon["details"]
                token = ", L"
                #level = int(string[string.find(token) + len(token):])
                name = string[:string.find(token)]
                battle.available_switches.append(name)
                print("available switch: " + name)


# Check if we need AI to make a move
def require_ai_action(msg):
    msg_lines = msg.split('\n')
    action = None
    for line in msg_lines:
        split_msg = line.split('|')
        if len(split_msg) < 2:
            continue
        action = split_msg[1].strip()
        if action in ['turn', 'upkeep', 'faint']:
            return True

    if action == 'inactive':
        return False

    # if action != "request":
    #     return battle.force_switch

async def ai_move(ps_websocket_client,battle):
    ai_action = ""
    if (battle.force_switch or len(battle.available_moves) == 0):
        switch_to = random.choice(battle.available_switches)
        ai_action = "/switch " + str(switch_to)
    else:
        #print("available_moves = " + str(battle.available_moves))
        move = random.choice(battle.available_moves)
        ai_action = "/choose move " + move
    await ps_websocket_client.send_message(battle.battle_tag,[ai_action])
    # user_input = input("requesting action...")
    # print("Processing user_input = " + user_input)
    # await ps_websocket_client.send_message(battle.battle_tag,[user_input])

async def pokemon_battle(ps_websocket_client: PSWebsocketClient, pokemon_battle_type):

    # This is always the case for now - may want to extend in the future
    #if "random" in pokemon_battle_type:
    battle = await _start_random_battle(ps_websocket_client)
    await ai_move(ps_websocket_client,battle) # first move outside loop because of server implementation

    # Turn on timer so opponent can't be a dick
    # await ps_websocket_client.send_message(battle.battle_tag,['/timer on'])

    # user_input = input("requesting action...")
    # print("Processing user_input = " + user_input)
    # await ps_websocket_client.send_message(battle.battle_tag,[user_input])


    # Main game loop
    while True:
        print("main game loop...")
        msg = await ps_websocket_client.receive_message()
        print("received message...")
        if constants.WIN_STRING in msg and constants.CHAT_STRING not in msg:
            winner = msg.split(constants.WIN_STRING)[-1].split('\n')[0].strip()
            logger.debug("Winner: {}".format(winner))
            # await ps_websocket_client.send_message(battle.battle_tag, [config.battle_ending_message])
            # await ps_websocket_client.leave_battle(battle.battle_tag, save_replay=config.save_replay)
            return winner

        parse_message(battle, msg)
        action_required = require_ai_action(msg)
        if action_required:
            await ai_move(ps_websocket_client,battle)

