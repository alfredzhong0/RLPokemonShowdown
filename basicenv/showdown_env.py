import gym
from gym import spaces

class ShowdownEnv(gym.Env):
    
    # As a parameter, we also want to pass in the opponent's policy
    def __init__(self):
        self.state = 0 
        # Actions are 0, 1
        self.action_space = spaces.Discrete(2)
        # Observations are always 0
        self.observation_space = spaces.Discrete(3)
    # 0 1 T
    def step(self, action):
        info = {} 
        obs = 0
        reward = 0
        done = False
        if action == 0:
            obs = 0
            self.state = obs
            print('Took a failing action!')
        elif action == 1 and self.state == 0:
            obs = 1
            self.state = 1 
            print('Got a reward!')
        elif action == 1 and self.state == 1:
            obs = 2
            self.state = 2
            done = True
            print('Reached terminal state!')

        reward = self._reward(action)
        return obs, reward, done, info     

    def _reward(self, action):
        reward = 0
        if action == 0:
            reward = -20
        else:
            if self.state == 0:
                reward = 1
            else:
                reward = 10
        return reward

    def reset(self):
        self.state = 0
        obs = 0
        return obs
