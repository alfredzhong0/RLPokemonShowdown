import random
import os, os.path
import time
import json
import gym
from gym import spaces
import numpy as np
from .client import send_action
from .client import send_agent_input
from .client import reset_game
from .load_embeddings import load_embeddings

class ShowdownEnv(gym.GoalEnv):
    
    def __init__(self, model=None, log_dir='./replay_logs', HER=False, num_pokemon=1):
        """{"player1":{"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0},"effects":[0,0,0,0],
        "pokemons":[{"name":"Mewtwo","hp":1,"active":true,"status":[0,0,0,0,0,0]},{"name":"Snorlax","hp":1,"active":false,"status":[0,0,0,0,0,0]}],"activemoves":[{"name":"splash","enabled":true},{"name":"leechseed","enabled":true},{"name":"haze","enabled":true}]},"player2":{"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0},"effects":[0,0,0,0],"pokemons":[{"name":"Mew","hp":1,"active":true,"status":[0,0,0,0,0,0]},{"name":"Snorlax","hp":1,"active":false,"status":[0,0,0,0,0,0]}],"activemoves":[{"name":"splash","enabled":true},{"name":"leechseed","enabled":true}, {"name":"haze","enabled":true}]},"winner":"empty"}""" 
        # Input dimensions and their high and low values 
        obs_low, obs_high = self.high_low() 
        # State space for regular algorithms
        if not HER: 
            self.observation_space = spaces.Box(obs_low, obs_high) 
        # State space for hindsight experience replay
        else:
            self.observation_space = spaces.Dict({\
                    'observation': spaces.Box(obs_low, obs_high),
                    'achieved_goal': spaces.Box(obs_low, obs_high),
                    'desired_goal': spaces.Box(obs_low, obs_high)
                    })
        self.replay_text = None
        self.steps = 0
        # Action space
        self.action_space = spaces.Discrete(9) 
        self.log_dir = log_dir
        # Load the move embeddings and the pokemon embeddings
        self.move_dict, self.poke_dict = load_embeddings()
        self.log_dir = log_dir
        self.agent_model = model
        self.num_pokemon = num_pokemon
    
    def set_model(self, model):
        print(model)
        self.agent_model = model

    def step(self, action):
        info = {} 
        # Set the reward to -0.1 by default so the agent finishes battles as quickly as possible
        # reward = -1
        # Alternatively, set the reward to 0. This may reduce reward variance.
        reward = 0
        done = False
        # Get the action text to send to the simulator
        agent_action = self.get_action(self.agent_model, self.agent_obs, 'player1')
        # Have the opponent be a random agent for now
        opp_action = self.get_random_action('player2')
        # Send the action to the simulator and get the new observation
        self.raw_state = json.loads(send_agent_input(agent_action, opp_action))
        self.agent_obs, self.opponent_obs = self.vectorize_obs(self.raw_state)
        # Assign a positive reward for a win and a negative reward for a loss
        #print('Winner State:', self.raw_state['winner'])
        if self.raw_state["winner"] != "empty":
                #print('Game is complete!')
                done = True
                self.steps = 0
                reward = 1 if 'Alice' in self.raw_state['winner'] else -1
                #print(self.raw_state['winner'])
                #print("Winner = " + self.raw_state["winner"])
                # Save replay text because openai baselines, for whatever reason, does callbacks based on timesteps
                self.replay_text = self.raw_state['replay']
                #self.write_replay_log()

        elif self.steps == 100:
            self.steps = 0
            reward = -1
            done = True
        else:
            self.steps += 1
        #print('Reward:', reward)

        obs = self.agent_obs
        return obs, reward, done, info     

    # Set the initial state and begin a new game
    def reset(self):
        #print('\n\nReset Called\n\n')
        self.raw_state = json.loads(reset_game(self.num_pokemon))
        self.agent_obs, self.opponent_obs = self.vectorize_obs(self.raw_state)
        return self.agent_obs

    # Normalize the action distribution to get only permissible actions
    def get_action(self, model, obs, player): 
        action_dist = model.action_probability(obs, state=None)
        # Provide a negative reward if the chosen action is invalid
        #chosen_action = np.argmax(action_dist)
        force_switch = False
        move_name = self.raw_state[player]["activemoves"][0]["name"]
        # Set invalid moves to have a probability of 0     
        for i in range(len(self.raw_state[player]["activemoves"])):
            move = self.raw_state[player]["activemoves"][i]
            if move["enabled"] == False:
                action_dist[i] = 0
            # If a pokemon on our side has fainted, we need to switch
            elif move_name == "SPECIAL_FORCE_SWITCH":
                force_switch = True
                action_dist[i] = 0
                #print('Disabling {}'.format(i))
        # Account for number of moves the pokemon has
        for i in range(1, 4):
            if i > (len(self.raw_state[player]["activemoves"]) - 1):
                action_dist[i] = 0
                #print('Disabling {}'.format(i))
           
        
        # Set invalid switches or trapped player switches to have a probability of 0
        alive_pokemon = len(self.raw_state[player]['pokemons'])
        if self.raw_state[player]['pokemons'][0]['hp'] == 0:
            alive_pokemon -= 1

        for i in range(1, len(self.raw_state[player]["pokemons"])):
            pokemon = self.raw_state[player]["pokemons"][i]
            #print('Trapped:', self.raw_state[player]['trapped'])
            if (pokemon["hp"] == 0.0) or (self.raw_state[player]['trapped']):
                #print('Disabling fainted switch')
                alive_pokemon -= 1
                action_dist[i + 3] = 0 
                #print('Disabling {}'.format(i + 4))
        # Invalidate switches to nonexistent pokemon
        for i in range(2, 7):
            if i > alive_pokemon and not (force_switch and i == alive_pokemon + 1):
                #print('Disabling nonexistent switch')
                action_dist[i - 2 + 4] = 0
        
        
        # Now normalize the probability of the action distribution
        action_dist /= np.sum(action_dist)

        # Select an action
        #print('Choice result:', np.random.choice(np.arange(0, 9, 1), p=action_dist))
        action_discrete = np.random.choice(np.arange(0, 9, 1), p=action_dist)
        if action_discrete < 4:
            action_text = 'move ' + self.raw_state[player]["activemoves"][action_discrete]["name"]
        else:
            # switch 2...6
            action_text = 'switch ' +  str(action_discrete - 2)
        #print('Chosen action:', chosen_action)

        # Return a negative reward for an invalid action
        #valid_action = action_dist[chosen_action] > 0
        #print('Actual Action:', action_text)
        return action_text

    # Return a valid random move for the given player
    def get_random_action(self, player):
        state = self.raw_state

        # AI LOGIC (random policy right now)
        p1move = "move 1"
        
        available_moves = []
        for i in range(len(state[player]["activemoves"])):
            move = state[player]["activemoves"][i]
            if (move["enabled"] == True):
                available_moves.append(i)
        move_idx = random.choice(available_moves)
        move_name = state[player]["activemoves"][move_idx]["name"]

        if (move_name == "SPECIAL_FORCE_SWITCH"):
            available_switches = []
            for i in range(len(state[player]["pokemons"])):
                pokemon = state[player]["pokemons"][i]
                if (pokemon["hp"] != 0.0):
                    available_switches.append(i+1)
            switch_idx = random.choice(available_switches)
            p1move = "switch " + str(switch_idx)

        elif (move_name == "SPECIAL_FORCE_WAIT"):
            p1move = "doesn't matter what we put here"
        else:
            p1move = "move " + move_name
        
        return p1move

    # Write a replay log to a file
    def write_replay_log(self):
        # Create the "replays" directory if it doesn't exist
        if not os.path.isdir(self.log_dir + '/replays'):
            os.makedirs(self.log_dir + '/replays/')
        # Write log if a replay is saved
        replay_text = self.replay_text

        if replay_text is not None:
            time_str = time.strftime('%Y%m%d-%H%M%S')
            file_name = self.log_dir + '/replays/' + time_str + '.log'
            with open(file_name, 'w') as log_file:
                log_file.write(replay_text)

    # Convert the observation we receive from the environment into a vector interpretable by our RL algo
    def vectorize_obs(self, obs):
        players = ['player1', 'player2']
        players_obs = []
        for player in players:
            # Add player's last move to array
            last_move_raw = obs[player]['last_move'].lower() 
            if last_move_raw != 'self-destruct':
                last_move_raw = last_move_raw.replace('-', '')
            last_move_raw = last_move_raw.replace(' ', '')
            # Set the last move observation based on the move_dict if it exists, otherwise output a blank observation
            last_move_obs = self.move_dict[last_move_raw] if len(last_move_raw) > 0 else np.zeros((10))
            # Add player buffs to np array 
            buff_obs = np.zeros((6))
            buff_dict = obs[player]['buffs']
            stat_num = 0
            for stat in list(buff_dict.keys()):
                # Sp. Attack and Sp. Defense are the same, so don't count the value twice
                if stat != 'spd':
                    buff_obs[stat_num] = buff_dict[stat]
                    stat_num += 1
            # Set effect obs(ie. leech seed, confusion, reflect, light screen)
            effect_obs = np.zeros((5))
            effects = obs[player]['effects']
            effect_num = 0
            for effect in effects:
                effect_obs[effect_num] = effect
                effect_num += 1
            effect_obs[4] = 0 if  obs[player]['trapped'] == False else 1

            pokemons = obs[player]['pokemons'] 
            pokes_obs = np.array([]) 
            # Add pokemon obs
            for pokemon in pokemons:
                # Get the pokemon obs 
                poke_obs = self.poke_dict[pokemon['name']]
                # Set if the pokemon is active
                active_obs = np.array([1]) if pokemon['active'] else np.array([0])
                poke_obs = np.concatenate((poke_obs, active_obs))
                # Get the status of a pokemon
                status_obs = np.array(pokemon['status'])
                # Get the hp of the pokemon
                hp_obs = np.array(pokemon['hp'])
                # Get each pokemon move obs (if its active)
                moves_obs = np.array([])
                if pokemon['active']:
                    num_moves = 0
                    active_moves = obs[player]['activemoves']
                    for move in active_moves:
                        # Get the move embedding based on the name
                        if move['name'] != 'SPECIAL_FORCE_SWITCH' and move['name'] != 'SPECIAL_FORCE_WAIT':
                            move_embedding = self.move_dict[move['name']]
                            # Set whether the move is enabled or disabled
                            enabled_obs = np.array([1]) if move['enabled'] else np.array([0])
                            move_obs = np.concatenate((move_embedding, enabled_obs), axis=0)
                            # Add the observation to the array of moves
                            moves_obs = np.concatenate((moves_obs, move_obs), axis=0)
                            num_moves += 1
                    # Add zeroed-out vectors for move embeddings to keep size of input to neural net consistent while accounting for pokes with < 4 moves
                    while num_moves < 4:
                        # This is 1 x 11 because a move embedding is length 10 and the enabled/disabled boolean is length 1
                        moves_obs = np.concatenate((moves_obs, np.zeros(11)), axis=0)
                        num_moves += 1
                # Stores each move observation
                moves_obs = np.array(moves_obs)
                # Stores the entire pokemon observation
                full_poke_obs = np.concatenate((poke_obs, status_obs, hp_obs.flatten(), moves_obs.flatten()))
                pokes_obs = np.concatenate((pokes_obs, full_poke_obs), axis=0)
            # Stores each pokemon observation
            pokes_obs = np.array(pokes_obs)
            # Stores the full player observation
            player_obs = np.concatenate((last_move_obs, buff_obs, effect_obs, pokes_obs))   
            players_obs.append(player_obs)
        # Combine each observation into a vector
        # Make the information about the agent's team on the left so it remains consistent
        agent_obs = np.concatenate((players_obs[0], players_obs[1]), axis=0).astype(np.double)
        opp_obs = np.concatenate((players_obs[1], players_obs[0]), axis=0).astype(np.double)
        return agent_obs, opp_obs


    # Define the upper (high) and lower (low) bounds for the input of the for the RL algo
    # input vector:
    # Low: [p1 active pokembedding: [-2] * 10 + active[0], p1 hp:[0],p1 moves: [-2] * 10 + disabled after each, p1 buffs [-6] * 6 
    # p1 status [0] * 6, p1 effects [0], p2 active pokembedding: [-2] * 10 + active[0]
    # , p2 active hp: [0], p2 status[0] * 6, p2 confusion [0, 0, 0 ,0], + last move of opponent
    def high_low(self):
        pokembedding_low = np.array([-2] * 10) 
        active_low = np.array([0])
        active_pokembedding_low = np.concatenate((pokembedding_low, active_low), axis=0)
        hp_low = np.array([0])

        movembedding_low = np.array([-2] * 10)
        enabled_move_low = np.array([0])
        move_low = np.concatenate((movembedding_low, enabled_move_low), axis=0)

        last_move_low = np.array([-2] * 10)
        buffs_low = np.array([-6] * 6)
        status_low = np.array([0] * 6)
        effects_low = np.array([0, 0, 0, 0, 0])

        p1_low = np.concatenate((last_move_low, buffs_low, effects_low, active_pokembedding_low, status_low, hp_low, move_low, move_low, move_low, move_low), axis=0)
        p2_low = np.concatenate((last_move_low, buffs_low, effects_low, active_pokembedding_low, status_low, hp_low, move_low, move_low, move_low, move_low), axis=0)

        obs_low = np.concatenate((p1_low, p2_low), axis=0)
        
        pokembedding_high = np.array([2] * 10) 
        active_high = np.array([1])
        active_pokembedding_high = np.concatenate((pokembedding_high, active_high), axis=0)

        hp_high = np.array([1])

        movembedding_high = np.array([2] * 10)
        enabled_move_high = np.array([1])
        move_high = np.concatenate((movembedding_high, enabled_move_high), axis=0)

        last_move_high = np.array([2] * 10)
        buffs_high = np.array([6] * 6)
        status_high = np.array([1] * 6)
        effects_high = np.array([1, 1, 1, 1, 1])

        p1_high = np.concatenate((last_move_high, buffs_high, effects_high, active_pokembedding_high, status_high, hp_high, move_high, move_high, move_high, move_high), axis=0)
        
        p2_high = np.concatenate((last_move_high, buffs_high, effects_high, active_pokembedding_high, status_high, hp_high, move_high, move_high, move_high, move_high), axis=0)

        obs_high = np.concatenate((p1_high, p2_high), axis=0)
        print(obs_low.shape)
        print(obs_high.shape)
        return obs_low, obs_high
