const Sim = require('./.sim-dist');
const readline = require('readline');

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
        console.log(output);
        iter += 1;
    }
    done = false
    if (iter >= 3) {
        while (!done) {
            output = await stream.read();
            // End the battle if a player has won
            if (containsWinStr(output)){
                console.log(output);
                done = true;
                process.stdin.pause();
            }
            // Check if an ai needs to input an action
            else if (aiRequiresAction(output)) { 
                console.log('Awaiting p1 input: ')
                user_input = await getLine();
                console.log(user_input)
                stream.write(`>p1 ${user_input}`)
                console.log('Awaiting p2 input: ')
                user_input = await getLine();
                console.log(user_input)
                stream.write(`>p2 ${user_input}`)
            }
            console.log(output);
        }
    }
    stream.end();
})();

stream.write(`>start {"formatid":"gen1ou"}`);
stream.write(`>player p1 {"name":"Alice", "team": "Mewtwo|||none|selfdestruct||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`);
stream.write(`>player p2 {"name":"Bob", "team": "Mew|||none|explosion||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`);