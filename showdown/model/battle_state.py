
class Move:

    def __init__(self, name, pp_max, enabled, move_type, power, accuracy, category):
        self.name = name
        self.pp_max = pp_max
        self.pp = pp_max
        self.enabled = enabled
        self.type = move_type # rock, fire, water, ..., unknown (single val)
        self.power = power
        self.accuracy = accuracy
        self.category = category # physical, special, status, unknown

    def __str__(self):
        return "[%s] (%i/%i) Type=%s, Power=%i, Accuracy=%i, Category=%s [%s]" % \
            (self.name, self.pp, self.pp_max, self.type, self.power, self.accuracy, \
                self.category, self.enabled)

class Pokemon:
    def __init__(self, name, position, pokemon_type, level, hp_max, stats, moves, status, is_active):
        self.name = name
        self.position = position # what position in the lineup is it? (useful when sending switch command to the server)
        self.type = pokemon_type # rock, thunder (array - can be multiple values)
        self.level = level
        self.hp_max = hp_max
        self.hp = hp_max
        self.stats = stats # array of vals like [atk]
        self.moves = moves
        self.status = status # none, asleep, confused, burned, ...
        self.is_active = is_active # is it the current pokemon being used

    def __str__(self):
        info1 = "[%s] (%i/%i) Type=%s Lvl=%i Status=%s <%s>" %\
            (self.name,self.hp,self.hp_max,self.type,self.level,self.status,("inactive","active")[self.is_active])
        info2 = str(self.stats)
        info3 = ""
        for i in range(len(self.moves)):
            info3 += str(self.moves[i]) +("","\n")[i<len(self.moves)-1]
        return info1 + "\n" + info2 + "\n" + info3


class RLBattle:
    def __init__(self, player_lineup, opponent_lineup):
        # self.P1 = "" # Player 1 
        # self.P2 = "" # Player 2
        # self.isP1 = False # Is the bot P1?
        self.battle_tag = "" # Need this to send messages to server (???)
        self.opponent_name = ""
        self.player_lineup = player_lineup
        self.opponent_lineup = opponent_lineup


