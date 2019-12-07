# Load in a trained model and evaluate it against a random policy
# Can load 2 models at the same time
# Currently for the 1v1 case
import time
import os
import gym
from stable_baselines import PPO2
from stable_baselines.common.policies import MlpPolicy
from stable_baselines.common.vec_env import DummyVecEnv
# from stable_baselines.common.evaluation import evaluate_policy

import pokemon


# Create environment

# Create log dir with timestamp
log_dir = "./log_showdown/1v1_meta_test/"
time_str = time.strftime('%Y%m%d-%H%M%S')
log_dir += time_str
os.makedirs(log_dir, exist_ok=True)

base_env = gym.make('Pokemon-v0', log_dir=log_dir, HER=False, num_pokemon=1, update_model=False, opponent_random_policy=True)

# model1 = Alice
# model2 = Bob

model2 = PPO2.load("./gauraang.pkl")
#model = PPO2.load("log_showdown/1v1_meta/20191206-23535020191207-012940.pkl");

env = DummyVecEnv([lambda: base_env])
model1 = PPO2.load("log_showdown/1v1_meta/20191206-23535020191207-012940.pkl");
#model2 = PPO2(MlpPolicy, env, verbose=0) # effectively a random policy

base_env.set_model(model1, model2)


# Evaluate the agent
# mean_reward, n_steps = evaluate_policy(model, model.get_env(), n_eval_episodes=10)

# Enjoy trained agent
num_games = 0
wins = 0
obs = base_env.reset()
while num_games < 10000:
    action, _states = model.predict(obs)
    #print(action)
    obs, reward, done, info = base_env.step(action)
    if (done):
    	num_games += 1
    	#print("reward = " + str(reward))
    	if (reward == 1):
    		wins += 1
    	obs = base_env.reset()

print("num_games = " + str(num_games))
print("wins = (%d/%d)" % (wins,num_games))


