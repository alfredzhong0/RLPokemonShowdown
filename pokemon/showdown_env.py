import gym
from gym import spaces
import numpy as np
import json
from .client import send_action
from .client import reset_server

class ShowdownEnv(gym.Env):
    
    # As a parameter, we also want to pass in the opponent's policy
    def __init__(self):
        # Actions are Thunderbolt, Water Gun
        """ Contains the HP of each pokemon and the moveset
        Pokemon A is Pikachu 
        23 is Thunderbolt, 12 is Bubble
        Pokemon B is a Squirtle
        32 is Water Gun and 0 is Splash
        The first 100 is the HP of Pikachu and the second 100 is the HP of Squirtle"""

        low = np.array([23, 12, 12, 0, 0, 0])
        high = np.array([23, 12, 12, 0, 100, 100])

        self.initial_state = np.array(high, copy=True)
        self.state = np.array(self.initial_state, copy=True)
        self.observation_space = spaces.Box(low,high)
        self.action_space = spaces.Discrete(2)

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
        res = reset_server()
        res = json.loads(res)['obs']
        obs = np.array(res)
        self.state = np.array(obs, copy=True)
        return obs
