class RLBattle 
{
  constructor(player_lineup, opponent_lineup) 
  {
    this.battle_tag = "" // Need this to send messages to server (???)
    this.opponent_name = ""
    this.player_lineup = player_lineup
    this.opponent_lineup = opponent_lineup


    // Helper vars
    this.force_switch = false // must switch to unfainted pokemon
    this.available_moves = [] // available moves that the AI can pick
    this.available_switches = []
  }

}

module.exports = RLBattle
