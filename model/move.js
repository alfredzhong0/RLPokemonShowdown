

class Move 
{
  constructor(name, pp_max, enabled, move_type, power, accuracy, category) 
  {
    this.name = name
    this.pp_max = pp_max
    this.pp = pp_max
    this.enabled = enabled
    this.type = move_type // rock, fire, water, ..., unknown (single val)
    this.power = power
    this.accuracy = accuracy
    this.category = category // physical, special, status, unknown
  }

  toString = function()
  {
	const sentence = `[${this.name}] (${this.pp}/${this.pp_max}) Type=${this.type}, Power=${this.power}, Accuracy=${this.accuracy}, Category= [${this.category}]`;
	return sentence;
  }
}

module.exports = Move