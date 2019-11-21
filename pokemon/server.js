const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 30680 });
class Env {
  constructor() {
    // Contains the HP of each pokemon and the moveset
    // Pokemon A is Pikachu 
    // 23 is Thunderbolt, 12 is water gun
    // Pokemon B is a Squirtle
    // 32 is Bubble and 0 is Splash
    // The first 100 is the HP of Pikachu and the second 100 is the HP of Squirtle
    this.initial_state = [23, 12, 12, 0, 100, 100]
    this.state = this.initial_state
    this.action_space = 2
    this.p1_moves = {thunderbolt: 25, bubble: 10}
    this.p2_moves = {watergun: 20, splash: 0}
  }    

  reset() {
    this.state = this.initial_state.slice();
    const obs = this.state;
    const res_obj = {obs: this.state};
    return JSON.stringify(res_obj);
  } 

  step(action) {
    // Convert the string received from the WebSocket into a number
    action = parseInt(action)
    // Apply the action to the environment
    const move = action == 0 ? 'thunderbolt' : 'bubble'
    console.log(`P1 used the move ${move}!`)
    // Assume the player always moves first
    const p1_damage = this.p1_moves[move] * this._damage_roll();
    this.state[5] -= p1_damage; 
    console.log(`${move} does ${p1_damage} damage!`)
    // Sample a random move from the uniform distribution for the opponent agent
    const opponent_move = this._pick_opponent_move();
    const p2_damage = this.p2_moves[opponent_move] * this._damage_roll();
    console.log(`P2 used the move ${opponent_move}!`)
    this.state[4] -= p2_damage;
    console.log(`${opponent_move} does ${p2_damage}!`);
    
    const obs = this.state;
    this.state[4] = this.state[4] < 0 ? 0 : this.state[4];
    this.state[5] = this.state[5] < 0 ? 0 : this.state[5];
    const reward = this._reward();
    const done = reward != 0 ? true : false;
    if (done) {
      if (reward < 0) {
        console.log('The random agent has won the match!');
      }
      else {
        console.log('The RL agent won! Congrats!')
      }
    }
    const res_obj = {obs: obs}
    return JSON.stringify(res_obj)
  }

  _reward() {
    if (this.state[4] == 0) {
      return -1;
    }
    else if (this.state[5] == 0){
      return 1;
    }
    else {
      return 0;
    }
  }
  // Based on the calculation of the random parameter in generations i and ii
  _damage_roll() {
    return (Math.random() * 38 + 217)/255
  }
  
  _pick_opponent_move() {
    const rand_num = Math.random()
    if (rand_num <= 0.5) {
      return 'watergun';
    }
    else {
      return 'splash';
    }
  }
}

let env = new Env();
wss.on('connection', function connection(ws) {
  name = '';
  console.log('Connected. Waiting for action.')
  ws.on('message', function incoming(action) {
    let result = '';
   
    console.log('received: %s', action);
    if (action == 'reset') {
        result = env.reset()
	
    }
    else {
	result = env.step(action);
    }
    ws.send(result);
  });

});

