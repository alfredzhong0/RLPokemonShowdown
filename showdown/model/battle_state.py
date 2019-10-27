
class Move:

    def __init__(self, name, max_pp, enabled, move_type, power, accuracy, category):
        self.name = name
        self.pp = max_pp
        self.enabled = enabled
        self.type = move_type # rock, ..., unknown (single val)
        self.power = power
        self.accuracy = accuracy
        self.category = category # physical, special, status, unknown

class Pokemon:
    def __init__(self, name, position, pokemon_type, level, hp_max, stats, moves, status, is_active):
        self.name = name
        self.position = position
        self.type = pokemon_type # rock, thunder (array - can be multiple values)
        self.hp_max = hp_max
        self.hp = hp_max
        self.stats = stats
        self.moves = moves
        self.status = status # none, asleep, burned, ...
        self.is_active = is_active

class Lineup:
    def __init__(self, is_player, pokemons):
        self.is_player = is_player
        self.pokemons = pokemons

class RLBattle:
    def __init__(self, player_lineup, opponent_lineup):
        self.player_lineup = player_lineup
        self.opponent_lineup = opponent_lineup