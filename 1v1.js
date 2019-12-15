const Sim = require('./.sim-dist');
const readline = require('readline');
const WebSocket = require('ws');
// const Move = require('./model/move.js');
// const Pokemon = require('./model/pokemon.js');
// const RLBattle = require('./model/rlbattle.js');


// Store the game state
const wss = new WebSocket.Server({ port: 39999 });
player_1 = {"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0}, "effects":[0,0,0,0], "last_move": "", "trapped": false};
player_2 = {"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0}, "effects":[0,0,0,0], "last_move": "", "trapped": false};
replay_log = ""
p1_move = "none"
p2_move = "none"

function aiRequiresAction(output) {
    msgLines = output.split('\n');

    for (line of msgLines) {
        splitMsg = line.split('|');

        if (splitMsg.length < 2) {
            continue;                
        }

        action = splitMsg[1].replace(/(^[ '\^\$\*#&]+)|([ '\^\$\*#&]+$)/g, '');
        if (['turn', 'upkeep', 'faint'].includes(action)){
            return true;        
        }

    }
    return false;
}

// Weird edge case where if player switches into Pokemon, and it instantly dies from opponents move,
// Then server sends two states, causing the game state to be inconsistent in the client
// Should only allow the second state to be sent
youShallPass = false
function satisfiesEdgeCase() {

    if (!youShallPass) {
        youShallPass = true
        if (p1_move.includes("switch")) { // Player 1's previous move is a switch
            if (player_1["pokemons"][0]["hp"] == 0) {
                console.log(player_1)
                console.log("You shall not pass")
                return false
            }
        }
        if (p2_move.includes("switch")) { // Player 2's previous move is a switch
            if (player_2["pokemons"][0]["hp"] == 0) {
                console.log(player_2)
                console.log("You shall not pass")
                return false
            }
        }

    }
    youShallPass = false
    return true
}

function containsWinStr(output) {
    const WIN_STRING = '|win|';
    return output.includes(WIN_STRING);
}

function parseServerOutput(output) {

    if (!output.includes("|request|")) { // Add everythin else to replay log
        replay_log += output
    }
    
    if (output.includes("|request|")) {
        token = "|request|"
        start = output.indexOf(token) + token.length
        jsonString = output.substring(start) //console.log("\n\n" + jsonString)
        player1 = output.includes("p1") ? true:false;
        gameState = JSON.parse(jsonString)

        if (player1) {
        	oldPokemon = player_1["pokemons"]
	    //console.log('Game State:')
	    //console.log(gameState)
	    if (gameState["active"]) {
            	player_1['trapped'] = gameState["active"][0]["trapped"] == true;
	    }
            else {
		player_1['trapped'] = false;
	    }
            player_1["pokemons"] = []
            player_1["activemoves"] = []
        }
        else {
        	oldPokemon = player_2["pokemons"]
	    if (gameState["active"]) {
            	player_2['trapped'] = gameState["active"][0]["trapped"] == true;
	    }
            else {
		player_2['trapped'] = false;
	    }
            player_2["pokemons"] = []
            player_2["activemoves"] = []
        }

        numPokemon = gameState["side"]["pokemon"].length
        for (var i = 0; i < numPokemon; i++) {
            pokemon = gameState["side"]["pokemon"][i]
            name = pokemon["details"].split(",")[0]
            health = 0.0
            if (!pokemon["condition"].includes("fnt")) {
                //hp_string = pokemon["condition"].split(" ")[0] // Ignore 'F' for faint
                hp = parseInt(pokemon["condition"].split("/")[0])
                hp_max = parseInt(pokemon["condition"].split("/")[1])
                health = hp * 1.0 / hp_max
            }

            active = pokemon["active"]
            newPokemon = {"name":name, "hp":parseFloat(health), "active": active, "status": [0,0,0,0,0,0]};
            
            // Statuses must persist
            if (oldPokemon != null) {
            	for (var j = 0; j < oldPokemon.length; j++) {
            		if (name == oldPokemon[j]["name"]) {
            			newPokemon["status"] = oldPokemon[j]["status"]
            			break;
            		}
            	}
            }
            

            if (player1) player_1["pokemons"].push(newPokemon)
            else player_2["pokemons"].push(newPokemon)
        }

        if ("forceSwitch" in gameState) {
            newMove = {"name":"SPECIAL_FORCE_SWITCH", "enabled": true}
            if (player1) player_1["activemoves"].push(newMove)
            else player_2["activemoves"].push(newMove)
        }
        else if ("wait" in gameState) {
            newMove = {"name":"SPECIAL_FORCE_WAIT", "enabled": true}
            if (player1) player_1["activemoves"].push(newMove)
            else player_2["activemoves"].push(newMove)
        }
        else {
            numMoves = gameState["active"][0]["moves"].length
            for (var i = 0; i < numMoves; i++) {
                move = gameState["active"][0]["moves"][i]
                name = move["id"]
                enabled = true
                if ("disabled" in move) enabled = !move["disabled"]

                newMove = {"name":name, "enabled": enabled}
                if (player1) player_1["activemoves"].push(newMove)
                else player_2["activemoves"].push(newMove)
            }
        }

    }


    else if (output.includes("update")) {

        lines = output.split("\n")
        for (var i = 0; i < lines.length; i++) {
            line = lines[i]

            if (line.includes("|-status|")) {
                // Status should only affect current pokemon - if there are no active pokemon
                // it means it has fainted, so status doesn't matter
                player1 = line.includes("p1a") ? true:false;

                // Find pokemon which status affects
                parts = line.split("|")
                name = parts[2].substring(parts[2].indexOf(": ")+2)
                pokemon = null
                if (player1) {
                    for (var j = 0; j < player_1["pokemons"].length; j++) {
                        if (player_1["pokemons"][j]["name"] == name) {
                            pokemon = player_1["pokemons"][j]
                            break
                        }
                    }
                }
                else {
                    for (var j = 0; j < player_2["pokemons"].length; j++) {
                        if (player_2["pokemons"][j]["name"] == name) {
                            pokemon = player_2["pokemons"][j]
                            break
                        }
                    }
                }

                // For that pokemon, set the status to 1, all other status to 0
                if (pokemon != null) {
                    var statuses = ["slp","tox","psn","brn","frz","par"]
                    for (var j = 0; j < statuses.length; j++) {
                        pokemon["status"][j] = 0
                        if (line.includes("|" + statuses[j])) {
                            pokemon["status"][j] = 1
                        }
                    }
                }
            }
            else if (line.includes("|-curestatus|")) {
                // Status should only affect current pokemon - if there are no active pokemon
                // it means it has fainted, so status doesn't matter
                player1 = line.includes("p1a") ? true:false;

                // Find pokemon which status affects
                parts = line.split("|")
                name = parts[2].substring(parts[2].indexOf(": ")+2)
                pokemon = null
                if (player1) {
                    for (var j = 0; j < player_1["pokemons"].length; j++) {
                        if (player_1["pokemons"][j]["name"] == name) {
                            pokemon = player_1["pokemons"][j]
                            break
                        }
                    }
                }
                else {
                    for (var j = 0; j < player_2["pokemons"].length; j++) {
                        if (player_2["pokemons"][j]["name"] == name) {
                            pokemon = player_2["pokemons"][j]
                            break
                        }
                    }
                }

                // For that pokemon, set the status to 0 (cure status)
                if (pokemon != null) {
                    var statuses = ["slp","tox","psn","brn","frz","par"]
                    for (var j = 0; j < statuses.length; j++) {
                        //pokemon["status"][j] = 0
                        if (line.includes("|" + statuses[j])) {
                            pokemon["status"][j] = 0
                        }
                    }
                }
            }
            else if (line.includes("|-boost|")) {
                player1 = line.includes("p1a") ? true:false;
                parts = line.split("|")
                key = parts[3]
                increase = parseInt(parts[4])
                if (player1) player_1["buffs"][key] += increase
                else player_2["buffs"][key] += increase
            }
            else if (line.includes("|-unboost|")) {
                player1 = line.includes("p1a") ? true:false;
                parts = line.split("|")
                key = parts[3]
                increase = -parseInt(parts[4]) // NEGATIVE!
                if (player1) player_1["buffs"][key] += increase
                else player_2["buffs"][key] += increase
            }
            else if (line.includes("|-start|")) {
                player1 = line.includes("p1a") ? true:false;
                tags = ["|reflect", "|light screen", "leech seed", "|confuse"] // Note: we ignore mist effect, too different to code
                idx = -1
                for (var j = 0; j < tags.length; j++) {
                    if (line.toLowerCase().includes(tags[j])) {
                        idx = j;
                        break;
                    }
                }
                if (idx != -1) {
                    if (player1) player_1["effects"][idx] = 1
                    else player_2["effects"][idx] = 1
                }
            }
            else if (line.includes("|-end|")) {
                player1 = line.includes("p1a") ? true:false;
                tags = ["|reflect", "|lightscreen", "|leechseed", "|confuse"] // Note: we ignore mist effect, too different to code
                idx = -1
                for (var j = 0; j < tags.length; j++) {
                    if (line.toLowerCase().includes(tags[j])) {
                        idx = j;
                        break;
                    }
                }
                if (idx != -1) {
                    if (player1) player_1["effects"][idx] = 0
                    else player_2["effects"][idx] = 0
                }
            }
            else if (line.includes("|switch|")) {
                player1 = line.includes("p1a") ? true:false;

                // Reset buffs,debuffs and confusion upon switch
                if (player1) {
                    player_1["buffs"] = {"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0};
                    player_1["effects"] = [0,0,0,0];
                }
                else {
                    player_2["buffs"] = {"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0};
                    player_2["effects"] = [0,0,0,0];
                }
            }

	   if (line.includes("|move|")) {
                player1 = line.includes("p1a") ? true:false;
		const splitLine = line.split("|");
		player_1["last_move"] = splitLine[3].toLowerCase();
	   }
        }

    }
    /*    
    console.log('\nPlayer 1');
    //console.log(JSON.stringify(player_1))
    console.log(player_1)
    if ("pokemons" in player_1) {
    	for (var i = 0; i < player_1["pokemons"].length; i++) {
    		console.log(player_1["pokemons"][i]["name"] + ": " + player_1["pokemons"][i]["status"])
    	}
    }

    console.log('\nPlayer 2');
    console.log(player_2)
    if ("pokemons" in player_2) {
    	for (var i = 0; i < player_2["pokemons"].length; i++) {
    		console.log(player_2["pokemons"][i]["name"] + ": " + player_2["pokemons"][i]["status"])
    	}
    }*/
    //console.log(JSON.stringify(player_2))
    // console.log("\x1b[0m");
     

}

// Simulate synchronous read from STDIN
// const rl = readline.createInterface({ input: process.stdin , output: process.stdout });
// const getLine = (function () {
//     const getLineGen = (async function* () {
//         for await (const line of rl) {
//             yield line;
//         }
//     })();
//     return async () => ((await getLineGen.next()).value);
// })();
function shuffleList(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

let rolling_winner = []
for (let i = 0; i < 100; i++) {
	rolling_winner[i] = 'Bob';
}

let game_counter = 0;

function getAliceRollingWinRate() {
  let awin = 0;
  for (let i = 0; i < 100; i++) {
	  if (rolling_winner[i] == 'Alice') {
		  awin += 1;
	  }
  }
  return awin;
}

function generateRandomTeam(teamsize) {

	available_pokemon = [
			"Raichu|||none|quickattack,thunderbolt,thunderwave,agility||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Onix|||none|earthquake,rockslide,harden,rest||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Alakazam|||none|reflect,recover,psychic,selfdestruct||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Blastoise|||none|hydropump,tailwhip,blizzard,seismictoss||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Charizard|||none|flamethrower,earthquake,swordsdance,firespin||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Gengar|||none|confuseray,lick,psychic,submission||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Hitmonchan|||none|rest,icepunch,thunderpunch,megapunch||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Venusaur|||none|leechseed,razorleaf,bodyslam,rest||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Cubone|||none|thrash,bonemerang,blizzard,earthquake||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Weezing|||none|splash,sludge,thunder,fireblast||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Scyther|||none|swordsdance,slash,quickattack,swift||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Jynx|||none|lovelykiss,psychic,toxic,blizzard||255,255,255,255,255,255||30,30,30,30,30,30||74|",
			"Exeggutor|||none|megadrain,reflect,stomp,psychic||255,255,255,255,255,255||30,30,30,30,30,30||74|",
            "Raticate|||none|hyperfang,quickattack,bodyslam,doubleedge||255,255,255,255,255,255||30,30,30,30,30,30||74|",
            "Fearow|||none|drillpeck,mirrormove,doubleedge,skyattack||255,255,255,255,255,255||30,30,30,30,30,30||74|",
            "Golem|||none|harden,earthquake,explosion,rockthrow||255,255,255,255,255,255||30,30,30,30,30,30||74|",
            "Gyarados|||none|bite,skullbash,toxic,hydropump||255,255,255,255,255,255||30,30,30,30,30,30||74|",
            "Dragonite|||none|dragonrage,hyperbeam,thunder,icebeam||255,255,255,255,255,255||30,30,30,30,30,30||74|",
            "Arcanine|||none|flamethrower,bodyslam,leer,takedown||255,255,255,255,255,255||30,30,30,30,30,30||74|",
            "Victreebel|||none|solarbeam,reflect,razorleaf,slam||255,255,255,255,255,255||30,30,30,30,30,30||74|",
		];

	available_pokemon = shuffleList(available_pokemon)
	teamString = ""
	for (var i=0; i < teamsize; i++) {
		teamString += available_pokemon[i] + "]"
	}
	teamString = teamString.substring(0, teamString.length - 1);
	return teamString

}



message_id = 0
wss.on('connection', function connection(ws) {


    ws.on('message', function incoming(action) {

        //console.log('received: %s', action);
        if (action.includes("new_game")) {
            let parts = action.split(",")
            const teamSize = parseInt(parts[1])

            replay_log = "" // Refresh replay log every game
            stream = new Sim.BattleStream();
            stream.write(`>start {"formatid":"gen1ou"}`);
            /*stream.write(`>player p1 {"name":"Alice"}`);
            stream.write(`>player p2 {"name":"Bob"}`);*/
	
            stream.write(`>player p1 {"name":"Alice", "team": "` + generateRandomTeam(teamSize) + `"}`);
            stream.write(`>player p2 {"name":"Bob", "team": "` + generateRandomTeam(teamSize) + `"}`);
	        //stream.write(`>player p1 {"name":"Alice", "team": "Raichu|||none|thunderbolt,splash, tackle, teleport||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`);
            //stream.write(`>player p2 {"name":"Bob", "team": "Squirtle|||none|tackle,splash,watergun,scratch||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`);

            (async () => {
                let output;
                iter = 0;
                    
                while ((iter < 3) && (output = await stream.read())) {
                    //console.log("\n<aaa: " + output + " aaa>");
                    parseServerOutput(output);
                    iter += 1;
                }
                done = false
                if (iter >= 3) {
                    while (!done) {
                        output = await stream.read();
                        //console.log(output)
                        //console.log("\n<bbb: " + output + " bbb>");
                        parseServerOutput(output); // Update internal state

                        // End the battle if a player has won
                        if (containsWinStr(output)){
                            done = true;
                            parts = output.split("\n")
                            for (var i = 0; i < parts.length; i++) {
                                line = parts[i]
                                if (containsWinStr(line)) {
                                    winner = line.split("|")[2]
                                }
                            }
                            // process.stdin.pause();
        		            wss.clients.forEach(function (client) {
            				 client.send(JSON.stringify({"player1":player_1,"player2":player_2,"winner": winner, 'replay': replay_log}));
            				    rolling_winner[game_counter % 100] = winner;
            				    console.log(`Win Rate: ${getAliceRollingWinRate()}`);
            				    game_counter += 1;
            				 client.close()
            			    })
		                    //console.log('Done sending winner');
                        }
                        // Detect if we need players to choose actions
                        else if (aiRequiresAction(output)) {
        		            //console.log('Sending State!!!')
                            if (true){//satisfiesEdgeCase()) {
            		            wss.clients.forEach(function (client) {
                                 msg = JSON.stringify({"player1":player_1,"player2":player_2,"winner":"empty","message_id":message_id})
                				 client.send(msg);
                				 console.log(msg)
                                 message_id += 1
                                 client.terminate()
                			    })
                            }
                        }
                        
                    }
                }
                stream.end();
		console.log('Stream over!');
            })();
            
        }
        else {
            actions = JSON.parse(action)
            console.log(actions)
            p1_move = actions["p1"]
            p2_move = actions["p2"]
            stream.write(">p1 " + p1_move);
            stream.write(">p2 " + p2_move);
        }

        
        
    });

});

