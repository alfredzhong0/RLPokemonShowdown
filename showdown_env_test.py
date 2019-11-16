import gym
import pokemon

from stable_baselines.common.policies import MlpPolicy 
from stable_baselines.common.vec_env import DummyVecEnv
from stable_baselines import PPO2 

env = gym.make('Pokemon-v0')
env = DummyVecEnv([lambda: env])
model = PPO2(MlpPolicy, env, verbose=1)
model.learn(total_timesteps=5000)

obs = env.reset()

print('Final Test!\n\n\n\n')
for eps in range(20):
    for steps in range (20):
        action, _states = model.predict(obs)
        obs, reward, done, _ = env.step(action)
        if done:
            break
