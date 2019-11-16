from gym.envs.registration import register

register(
    id='Pokemon-v0',
    entry_point='pokemon.showdown_env:ShowdownEnv',
    reward_threshold=1,
)
