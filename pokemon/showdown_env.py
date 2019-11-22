import gym
from gym import spaces
import numpy as np
import json
from .client import send_action
from .client import reset_server
from .client import reset_game
from .load_embeddings import load_embeddings

class ShowdownEnv(gym.Env):
    
    # As a parameter, we also want to pass in the opponent's policy
    def __init__(self):
        """{"player1":{"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0},"confusion":false,"pokemons":[{"name":"Mewtwo","hp":0.5857605177993528,"active":true,"status":[0,0,0,0,0,0]},{"name":"Snorlax","hp":1,"active":false,"status":[0,0,0,0,0,0]}],"activemoves":[{"name":"splash","enabled":true},{"name":"reflect","enabled":true}]},"player2":{"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0},"confusion":false,"pokemons":[{"name":"Mew","hp":1,"active":true,"status":[0,0,0,0,0,0]}],"activemoves":[{"name":"splash","enabled":true},{"name":"haze","enabled":true},{"name":"earthquake","enabled":true}]},"winner":"empty"}"""
        

        # Define the high and low input for the RL algo
        # input vector:
        # Low: [p1 active pokembedding: [-2] * 10 + active[0], p1 hp:[0],p1 moves: [-2] * 10 + disabled after each, p1 buffs [-6] * 6, p1 status [0] * 6, p1 confusion [0], p2 active pokembedding: [-2] * 10 + active[0]
        # , p2 active hp: [0], p2 status[0] * 6, p2 confusion [0], 
        pokembedding_low = np.array([-2] * 10) 
        active_low = np.array([0])
        active_pokembedding_low = np.concatenate((pokembedding_low, active_low), axis=0)
        hp_low = np.array([0])

        movembedding_low = np.array([-2] * 10)
        enabled_move_low = np.array([0])
        move_low = np.concatenate((movembedding_low, enabled_move_low), axis=0)


        buffs_low = np.array([-6] * 10)
        status_low = np.array([0] * 6)
        confusion_low = np.array([0])

        p1_low = np.concatenate((active_pokembedding_low, hp_low, move_low, move_low, move_low, move_low, buffs_low, status_low, confusion_low), axis=0)
        p2_low = np.concatenate((active_pokembedding_low, hp_low, move_low, move_low, move_low, move_low, buffs_low, status_low, confusion_low), axis=0)
        
        obs_low = np.concatenate((p1_low, p2_low), axis=0)
        
        pokembedding_high = np.array([2] * 10) 
        active_high = np.array([1])
        active_pokembedding_high = np.concatenate((pokembedding_high, active_high), axis=0)

        hp_high = np.array([1])

        movembedding_high = np.array([2] * 10)
        enabled_move_high = np.array([1])
        move_high = np.concatenate((movembedding_high, enabled_move_high), axis=0)


        buffs_high = np.array([6] * 10)
        status_high = np.array([1] * 6)
        confusion_high = np.array([1])

        p1_high = np.concatenate((active_pokembedding_high, hp_high, move_high, move_high, move_high, move_high, buffs_high, status_high, confusion_high), axis=0)
        p2_high = np.concatenate((active_pokembedding_high, hp_high, move_high, move_high, move_high, move_high, buffs_high, status_high, confusion_high), axis=0)
        
        obs_high = np.concatenate((p1_high, p2_high), axis=0)
       
        self.observation_space = spaces.Box(obs_low, obs_high)
        self.action_space = spaces.Discrete(9)
        
        # Load the move embeddings and the pokemon embeddings
        self.move_dict, self.poke_dict = load_embeddings()

    def vectorize_state():
        pass 

    def step(self, action):
        info = {} 
        obs = 0
        reward = 0
        done = False
        # Send the action to the simulator
        res = send_action(action)
        # The result includes the variables observation, and done
        print('Raw result:', res)
        res_dict = json.loads(res)
        obs = np.array(res_dict['obs'])
        self.state = np.array(obs, copy=True)
        reward = self._reward()
        done = True if reward != 0 else False
        return obs, reward, done, info     

    def _reward(self):
        if self.state[4] <= 0:
            return -1
        elif self.state[5] <= 0:
            return 1
        else:
            return 0

    def reset(self):
        # Set the initial state and begin a game
        self.state = reset_game()
        print(self.state)
        return self.state
