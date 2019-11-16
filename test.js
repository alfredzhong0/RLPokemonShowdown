var assert = require('assert')


const Sim = require('./.sim-dist');
const { promises: fs } = require('fs') 
stream = new Sim.BattleStream();

// Load stored battle state
// async function getContent() {
//     return fs.readFile('alfred.json', "utf-8");
// }

// Main loop
(async () => {
    let output;

    while ((output = await stream.read())) {
        console.log(output);
        console.log("stream.alfred = " + stream.alfred)


        if(stream.alfred == `>player p2 {"name":"Bob"}`) {
        	//stream.battle["sides"][0]["pokemon"][0]["hp"] = 1000
        }
    }
    
})();



// Commands
//(async () => {
    
    //console.log(jsonString);
    stream.write(`>start {"formatid":"gen1ou"}`);
    stream.write(`>player p1 {"name":"Alice", "team":"Golbat|||none|hyperbeam,confuseray,megadrain,doubleedge||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`)//"team":"Golbat|||none|hyperbeam,confuseray,megadrain,doubleedge||255,255,255,255,255,255||30,30,30,30,30,30||74|]Jigglypuff|||none|sing,seismictoss,bodyslam,blizzard||255,255,255,255,255,255||30,30,30,30,30,30||88|]Rhyhorn|||none|substitute,rockslide,earthquake,bodyslam||255,255,255,255,255,255||30,30,30,30,30,30||88|]Cloyster|||none|hyperbeam,surf,explosion,blizzard||255,255,255,255,255,255||30,30,30,30,30,30||68|]Weedle|||none|stringshot,poisonsting||255,255,255,255,255,255||30,30,30,30,30,30||99|]Ninetales|||none|reflect,confuseray,fireblast,bodyslam||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`);
    stream.write(`>player p2 {"name":"Boba", "team":"Golbat|||none|hyperbeam,confuseray,megadrain,doubleedge||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`)
    //stream.write(`>player p2 {"name":"Bob", "team":"Golbat|||none|hyperbeam,confuseray,megadrain,doubleedge||255,255,255,255,255,255||30,30,30,30,30,30||74|]Jigglypuff|||none|sing,seismictoss,bodyslam,blizzard||255,255,255,255,255,255||30,30,30,30,30,30||88|]Rhyhorn|||none|substitute,rockslide,earthquake,bodyslam||255,255,255,255,255,255||30,30,30,30,30,30||88|]Cloyster|||none|hyperbeam,surf,explosion,blizzard||255,255,255,255,255,255||30,30,30,30,30,30||68|]Weedle|||none|stringshot,poisonsting||255,255,255,255,255,255||30,30,30,30,30,30||99|]Ninetales|||none|reflect,confuseray,fireblast,bodyslam||255,255,255,255,255,255||30,30,30,30,30,30||74|"}`);


    //console.log()
    // console.log(stream.battle)
    // stream.battle = Sim.Battle.fromJSON(JSON.parse(jsonString))
    // console.log(stream.battle["sides"][1]["pokemon"][0]["speciesData"]["id"])//setTimeout(() => console.log(stream.battle), 4000);

    setTimeout(function () {
    stream.write(`>p1 move 1`);
	stream.write(`>p2 move 1`);
    stream.write(`>p1 move 1`);
    stream.write(`>p2 move 1`);
    stream.write(`>p1 move 1`);
    stream.write(`>p2 move 1`);
    stream.write(`>p1 move 1`);
    stream.write(`>p2 move 1`);
    stream.write(`>p1 move 1`);
    stream.write(`>p2 move 1`);
    }, 1000)
 //    stream.write(`>p1 move 3`);
	// stream.write(`>p2 move 1`);

	//console.log(stream.battle["sides"][0]["pokemon"][0]["hp"])

    
    // console.log("aaa\n\n\n"+stream.battle["sides"][0]["pokemon"][0]["speciesData"]["id"])
//})()






