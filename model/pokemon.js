

class Pokemon
{
  constructor(name, position, pokemon_type, level, hp_max, stats, moves, status, is_active) 
  {
    this.name = name
    this.position = position // what position in the lineup is it? (useful when sending switch command to the server)
    this.type = pokemon_type // rock, thunder (array - can be multiple values)
    this.level = level
    this.hp_max = hp_max
    this.hp = hp_max
    this.stats = stats // array of vals like [atk]
    this.moves = moves
    this.status = status // none, asleep, confused, burned, ...
    this.is_active = is_active // is it the current pokemon being used
  }

  toString = function()
  {
  	const info1 = `[${this.name}] (${this.hp}/${this.hp_max}) Type=${this.type}, Lvl=${this.level}, Status=${this.status} <${this.is_active ? "active" : "inactive"}>`;
  	const info2 = this.stats.toString()
    const info3 = ""
    for (var i = 0; i < this.moves.length; i++){
      info3 += this.moves[i].toString()
      info3 += (i < this.moves.length-1) ? "\n" : ""
    }
    const sentence = info1 + "\n" + info2 + "\n" + info3
    return sentence;
  }
}

module.exports = Pokemon