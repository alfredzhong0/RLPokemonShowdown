import asyncio
import websockets
import json
import random
import numpy as np

uri = "ws://localhost:39999"
async def hello():
    async with websockets.connect(uri) as websocket:
        name = input("What's your name? ")

        await websocket.send(name)
        print(f"> {name}")

        greeting = await websocket.recv()
        print(f"< {greeting}")

async def send_action_wrapper(action):
    async with websockets.connect(uri) as websocket:
        await websocket.send(action)
        print('Action:', action)
        res = await websocket.recv()
    return res

def send_action(action):
    action = str(action)
    return asyncio.get_event_loop().run_until_complete(send_action_wrapper(action))

async def send_agent_input_wrapper(action_a, action_b):
    state_msg = {}
    try :
        async with websockets.connect(uri, ping_interval=None) as websocket:
            action = json.dumps({"p1": action_a, "p2": action_b})
            # Sending action
            #print(action)
            await websocket.send(action)
            #print('waiting on state message')
            state_msg = await websocket.recv()
            #print('got state message')
    except:
        print('\n\n\n\nEXCEPTION!!!\n\n\n\n')
        print(state_msg) 

    return state_msg

# Send input for two agents
def send_agent_input(action_a, action_b):
    return asyncio.get_event_loop().run_until_complete(send_agent_input_wrapper(action_a, action_b))


async def test_random_policy():
    async with websockets.connect(uri) as websocket:

        await websocket.send("new_game")
        get_first_state = False
        while (True):
            state_msg = await websocket.recv()

            if not get_first_state:
                print("\nReceived state: " + state_msg)
                get_first_state = True
            state = json.loads(state_msg)

            if (state["winner"] != "empty"):
                print("Winner = " + state["winner"])
                #print("Replay log = \n" + state["replay"])
                break

            # AI LOGIC (random policy right now)
            p1move = "move 1"
            p2move = "move 1"
            
            available_moves = []
            for i in range(len(state["player1"]["activemoves"])):
                move = state["player1"]["activemoves"][i]
                if (move["enabled"] == True):
                    available_moves.append(i)
            move_idx = random.choice(available_moves)
            move_name = state["player1"]["activemoves"][move_idx]["name"]

            if (move_name == "SPECIAL_FORCE_SWITCH"):
                available_switches = []
                for i in range(len(state["player1"]["pokemons"])):
                    pokemon = state["player1"]["pokemons"][i]
                    if (pokemon["hp"] != 0.0):
                        available_switches.append(i+1)
                switch_idx = random.choice(available_switches)
                p1move = "switch " + str(switch_idx)

            elif (move_name == "SPECIAL_FORCE_WAIT"):
                p1move = "doesn't matter what we put here"
            else:
                p1move = "move " + move_name



            available_moves = []
            for i in range(len(state["player2"]["activemoves"])):
                move = state["player2"]["activemoves"][i]
                if (move["enabled"] == True):
                    available_moves.append(i)
            move_idx = random.choice(available_moves)
            move_name = state["player2"]["activemoves"][move_idx]["name"]

            if (move_name == "SPECIAL_FORCE_SWITCH"):
                available_switches = []
                for i in range(len(state["player2"]["pokemons"])):
                    pokemon = state["player2"]["pokemons"][i]
                    if (pokemon["hp"] != 0.0):
                        available_switches.append(i+1)
                switch_idx = random.choice(available_switches)
                p2move = "switch " + str(switch_idx)

            elif (move_name == "SPECIAL_FORCE_WAIT"):
                p2move = "doesn't matter what we put here"
            else:
                p2move = "move " + move_name



            action = json.dumps({"p1":p1move, "p2":p2move})
            #print("action = " + action)
            await websocket.send(action)

async def reset_game_wrapper():
    state_msg = {}
    try:
        async with websockets.connect(uri, ping_interval=None) as websocket:
            await websocket.send("new_game")
            state_msg = await websocket.recv()

    except:
        print('\n\n\n\nEXCEPTION!!!!\n\n\n\n\n')
        print(state_msg)
    
    return state_msg



def reset_game():
    return asyncio.get_event_loop().run_until_complete(reset_game_wrapper())

async def test_user_input():
    async with websockets.connect(uri) as websocket:

        await websocket.send("new_game")
        while (True):
            state_msg = await websocket.recv()

            print("\n\n\n\n\n\nReceived state: " + state_msg)
            """{"player1":{"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0},"confusion":false,"pokemons":[{"name":"Mewtwo","hp":0.5857605177993528,"active":true,"status":[0,0,0,0,0,0]},{"name":"Snorlax","hp":1,"active":false,"status":[0,0,0,0,0,0]}],"activemoves":[{"name":"splash","enabled":true},{"name":"reflect","enabled":true}]},"player2":{"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0},"confusion":false,"pokemons":[{"name":"Mew","hp":1,"active":true,"status":[0,0,0,0,0,0]}],"activemoves":[{"name":"splash","enabled":true},{"name":"haze","enabled":true},{"name":"earthquake","enabled":true}]},"winner":"empty"}"""

           # 1v1 - p1 pokemon, p1 pokemon moves, buffs, confusion, status, p2 pokemon, p2 moves  

            state = json.loads(state_msg)

            if (state["winner"] != "empty"):
                print("Winner = " + state["winner"])
                print("Replay log = \n" + state["replay"])
                break

            p1move = input("Player 1 action:")
            p2move = input("Player 2 action:")

            action = json.dumps({"p1":p1move, "p2":p2move})
            #print("action = " + action)
            await websocket.send(action)

#asyncio.get_event_loop().run_until_complete(test_user_input())
#asyncio.get_event_loop().run_until_complete(test_random_policy())

