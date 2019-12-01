import os

import gym
import numpy as np
import matplotlib.pyplot as plt
import time

from stable_baselines.bench import Monitor
from stable_baselines.results_plotter import load_results, ts2xy
from stable_baselines import results_plotter
from stable_baselines.common.policies import MlpPolicy
from stable_baselines.common.vec_env import DummyVecEnv
from stable_baselines import PPO2
from stable_baselines import ACER

import pokemon


best_mean_reward, n_steps = -np.inf, 0

def callback(_locals, _globals):

    """
    Callback called at each step (for DQN an others) or after n steps (see ACER or PPO2)
    :param _locals: (dict)
    :param _globals: (dict)
    """
    global n_steps, best_mean_reward
    #print('Best Mean Reward:', best_mean_reward)
    # Print stats every 1000 calls
    #print(n_steps)
    if n_steps % 10 == 0:
        print('Saving Model...')
        time_str = time.strftime('%Y%m%d-%H%M%S')
        _locals['self'].save(log_dir + '/' + time_str + '.pkl')
        # Evaluate policy training performance
        x, y = ts2xy(load_results(log_dir), 'timesteps')
        if len(x) > 0:
            print(np.mean(y[-10:]))
            mean_reward = np.mean(y[-10:])
            print('\n\nMean reward: {}\n\n'.format(mean_reward))
            print(x[-1], 'timesteps')
            print("Best mean reward: {:.2f} - Last mean reward per episode: {:.2f}".format(best_mean_reward, mean_reward))

            # New best model, you could save the agent here
            if mean_reward > best_mean_reward:
                best_mean_reward = mean_reward
                # Example for saving best model
                print("Saving new best model")
                _locals['self'].save(log_dir + 'best_model.pkl')
    n_steps += 1
    n_steps += 1
    return True

# Create log dir
log_dir = "./log_showdown/"
os.makedirs(log_dir, exist_ok=True)

# Create and wrap the environment
base_env = gym.make('Pokemon-v0', log_dir=log_dir)
env = Monitor(base_env, log_dir, allow_early_resets=True)
env = DummyVecEnv([lambda: base_env])
model = PPO2(MlpPolicy, env, verbose=0)
base_env.set_model(model)
n_steps = 50000
model.learn(n_steps, callback=callback)
model.save(log_dir + '/best_model.pkl')
#results_plotter.plot_results([log_dir], 15000, results_plotter.X_TIMESTEPS, "Showdown")
#plt.show()
