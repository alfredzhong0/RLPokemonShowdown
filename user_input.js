const Sim = require('./.sim-dist');
const readline = require('readline');
// const Move = require('./model/move.js');
// const Pokemon = require('./model/pokemon.js');
// const RLBattle = require('./model/rlbattle.js');


// Store the game state
player_1 = {"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0}, "confusion":false};
player_2 = {"buffs":{"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0}, "confusion":false};


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
function containsWinStr(output) {
    const WIN_STRING = '|win|';
    return output.includes(WIN_STRING);
}
function parseServerOutput(output) {



    //return;
    //console.log(output)
    
    if (output.includes("|request|")) {
        token = "|request|"
        start = output.indexOf(token) + token.length
        jsonString = output.substring(start) //console.log("\n\n" + jsonString)
        player1 = output.includes("p1") ? true:false;

        gameState = JSON.parse(jsonString)

        if (player1) {
            player_1["pokemons"] = []
            player_1["activemoves"] = []
        }
        else {
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

                // Find active pokemon
                parts = line.split("|")
                name = parts[3].substring(parts[3].indexOf(": ")+2)
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
                        if (line.includes("|" + statuses[i]))
                            pokemon["status"][j] = 1
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
            else if (line.includes("|-start|") && line.includes("|confusion")) {
                player1 = line.includes("p1a") ? true:false;
                if (player1) player_1["confusion"] = true
                else player_2["confusion"] = true
            }
            else if (line.includes("|-end|") && line.includes("|confusion")) {
                player1 = line.includes("p1a") ? true:false;
                if (player1) player_1["confusion"] = false
                else player_2["confusion"] = false
            }
            else if (line.includes("|switch|")) {
                player1 = line.includes("p1a") ? true:false;

                // Reset buffs,debuffs and confusion upon switch
                if (player1) {
                    player_1["buffs"] = {"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0};
                    player_1["confusion"] = false;
                }
                else {
                    player_2["buffs"] = {"atk":0,"def":0,"spe":0,"spa":0,"spd":0,"evasion":0,"accuracy":0}
                    player_2["confusion"] = false
                }
            }
        }

    }

    console.log('\nPlayer 1');
    //console.log(JSON.stringify(player_1))
    console.log(player_1)
    console.log('\nPlayer 2');
    console.log(player_2)
    //onsole.log(JSON.stringify(player_2))
    console.log("\x1b[0m");


}

const rl = readline.createInterface({ input: process.stdin , output: process.stdout });
// Simulate synchronous read from STDIN
const getLine = (function () {
    const getLineGen = (async function* () {
        for await (const line of rl) {
            yield line;
        }
    })();
    return async () => ((await getLineGen.next()).value);
})();

// Create a battle stream
stream = new Sim.BattleStream();
(async () => {
    let output;
    iter = 0;
        
    while ((iter < 3) && (output = await stream.read())) {
        console.log("\n<aaa: " + output + " aaa>");
        parseServerOutput(output);
        iter += 1;
    }
    done = false
    if (iter >= 3) {
        while (!done) {
            output = await stream.read();
            console.log("\n<bbb: " + output + " bbbß>");
            parseServerOutput(output); // Update internal state

            // End the battle if a player has won
            if (containsWinStr(output)){
                //console.log(output);
                done = true;
                process.stdin.pause();
            }
            // Check if an ai needs to input an action
            else if (aiRequiresAction(output)) { 
                console.log('Awaiting p1 input: ')
                user_input = await getLine();
                //console.log(user_input)
                stream.write(`>p1 ${user_input}`)
                console.log('Awaiting p2 input: ')
                user_input = await getLine();
                //console.log(user_input)
                stream.write(`>p2 ${user_input}`)
            }
            
        }
    }
    stream.end();
})();

stream.write(`>start {"formatid":"gen1ou"}`);
stream.write(`>player p1 {"name":"Alice"}`);
stream.write(`>player p2 {"name":"Bob"}`);
//stream.write(`>player p1 {"name":"Alice", "team": "Mewtwo|||none|harden,poison||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`);
//stream.write(`>player p2 {"name":"Bob", "team": "Mew|||none|thunderwave||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`);





