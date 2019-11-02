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
                token = "p1: "
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

            # print("done...")

            # sys.exit(1)

            return battle
            # return battle, opponent_id, user_json


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


# Check if we need user input
async def require_user_input(msg):
    msg_lines = msg.split('\n')
    action = None
    for line in msg_lines:
        split_msg = line.split('|')
        if len(split_msg) < 2:
            continue
        action = split_msg[1].strip()
        if action in ['turn', 'upkeep']:
            return True

    if action == 'inactive':
        return False

    # if action != "request":
    #     return battle.force_switch

async def pokemon_battle(ps_websocket_client: PSWebsocketClient, pokemon_battle_type):

    # This is always the case for now - may want to extend in the future
    if "random" in pokemon_battle_type:
        Scoring.POKEMON_ALIVE_STATIC = 30  # random battle benefits from a lower static score for an alive pkmn
        battle = await _start_random_battle(ps_websocket_client)

    # Turn on timer so opponent can't be a dick
    # await ps_websocket_client.send_message(battle.battle_tag,['/timer on'])

    print("requesting action...")
    user_input = input("requesting action...")
    print("Processing user_input = " + user_input)
    await ps_websocket_client.send_message(battle.battle_tag,[user_input])

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
        action_required = await require_user_input(msg)
        if action_required:
            user_input = input("requesting action...")
            print("Processing user_input = " + user_input)
            await ps_websocket_client.send_message(battle.battle_tag,[user_input])
