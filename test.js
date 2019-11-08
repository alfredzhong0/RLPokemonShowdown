var assert = require('assert')

// var BattleTextStream = require('./.sim-dist/battle-stream').BattleTextStream;
// var Streams = require('./.lib-dist/streams');
// var stdin = new Streams.ReadStream(process.stdin);
// var stdout = new Streams.WriteStream(process.stdout);

// var battleStream = new BattleTextStream({
// 	debug: process.argv[3] === '--debug'
// });
// battleStream.start();



// // // stdin.pipeTo(battleStream);
// // console.log("ddd")
// // //battleStream.pipeTo(stdout);
// // console.log("eee")

// // command = 
// // `>start {"formatid":"gen1randombattle"}
// // >player p1 {"name":"Alice"}
// // >player p2 {"name":"Bob"}
// // >p1 move 1
// // >p2 move 1
// // >p1 move 1
// // >p2 move 1
// // `
// // var stdin = new Streams.ReadStream(command);
// // stdin.pipeTo(battleStream);
// // battleStream.pipeTo(stdout);
// // print("~~~~~~~end step 1~~~~~~~~")

// command = 
// `>start {"formatid":"gen1randombattle"}
// >player p1 {"name":"Alice"}
// >player p2 {"name":"Bob"}
// >p1 move 1
// >p2 move 1
// >p1 move 1
// >p2 move 1
// `
// var stdin = new Streams.ReadStream(command);
// stdin.pipeTo(battleStream);
// battleStream.pipeTo(stdout);
// console.log("~~~~~~~end step 1~~~~~~~~")


// command = 
// `>p1 move 1
// >p2 move 1
// `
// stdin = new Streams.ReadStream(command);
// stdin.pipeTo(battleStream);
// battleStream.pipeTo(stdout);
// console.log("~~~~~~~end step 2~~~~~~~~")


const Sim = require('./.sim-dist');
const { promises: fs } = require('fs') 
stream = new Sim.BattleStream();


// Load stored battle state
async function getContent() {
    return fs.readFile('alfred.json', "utf-8");
}





// Main loop
(async () => {
    let output;

    while ((output = await stream.read())) {
        console.log(output);
        console.log("stream.alfred = " + stream.alfred)


        if(stream.alfred == `>player p2 {"name":"Bob"}`) {
        	
        	//stream.battle["sides"][0]["pokemon"][0]["hp"] = 1000
        	// console.log("detected, switching battle state\n\n\n")
        	jsonString = await getContent();
			console.log(stream.battle["sides"][0]["pokemon"][0]["moveSlots"]) 
        	
        	aaa = JSON.parse(JSON.stringify(jsonString))
        	
        	stream.battle = Object.assign(stream.battle, aaa)
        	// Object.assign(stream.battle["sides"][0]["pokemon"][1], JSON.parse(metapod))
        	// stream.battle["sides"][0]["pokemon"][1] = JSON.parse(metapod)
        	// stream.battle["sides"][0]["pokemon"][2] = JSON.parse(metapod)
        	// stream.battle["sides"][0]["pokemon"][3] = JSON.parse(metapod)
        	// stream.battle["sides"][0]["pokemon"][4] = JSON.parse(metapod)
        	// stream.battle["sides"][0]["pokemon"][5] = JSON.parse(metapod)

        	//oldBattle = Object.create(stream.battle)
        	//stream.battle = Sim.Battle.fromJSON(JSON.parse(JSON.stringify(stream.battle)))
        	//stream.battle = oldBattle
        	// console.log("yyy:\n" + )
        	// console.log("zzz:\n" + Sim.Battle.fromJSON(JSON.parse(jsonString)))
         //    stream.battle = Sim.Battle.fromJSON(JSON.parse(jsonString))
        	//console.log(stream.battle["sides"][1]["pokemon"][0]["speciesData"]["id"])
        }
        // if (stream.battle) {
        // 	console.log("\n\n" + JSON.stringify(stream.battle.toJSON()))
        // }   
    }
    
})();



// Commands
//(async () => {
    
    //console.log(jsonString);
    stream.write(`>start {"formatid":"gen1randombattle"}`);
    stream.write(`>player p1 {"name":"Alice"}`);
    stream.write(`>player p2 {"name":"Bob"}`);


    //console.log()
    // console.log(stream.battle)
    // stream.battle = Sim.Battle.fromJSON(JSON.parse(jsonString))
    // console.log(stream.battle["sides"][1]["pokemon"][0]["speciesData"]["id"])//setTimeout(() => console.log(stream.battle), 4000);

    setTimeout(function () {
    stream.write(`>p1 move 3`);
	stream.write(`>p2 move 1`);
    }, 5000)
 //    stream.write(`>p1 move 3`);
	// stream.write(`>p2 move 1`);

	//console.log(stream.battle["sides"][0]["pokemon"][0]["hp"])

    
    // console.log("aaa\n\n\n"+stream.battle["sides"][0]["pokemon"][0]["speciesData"]["id"])
//})()



// (async () => {

// 	console.log("awaiting...")
// 	await aaa()
// 	console.log("awaited...")

// 	stream.write(`>p1 move 1`);
// 	console.log("bbb \n\n\n"+stream.battle["sides"][0]["pokemon"][0]["speciesData"]["id"])
// 	stream.write(`>p2 move 1`);
// 	console.log("bbb \n\n\n"+stream.battle["sides"][0]["pokemon"][0]["speciesData"]["id"])


// })();




// jsonString = ""
// async function aaa() {
// 	fs.readFile('alfred.json', (err, data) => { 
// 	    if (err) {
// 	    	console.log(err)
// 	    	throw err; 
// 	    }
// 	  	jsonString = data.toString(); //`{"result":true}`//
// 	  	console.log("alalfred")
// 	}) 
// }

// aaa()
// console.log("Loading json = " + jsonString)
// stream.battle = JSON.parse(jsonString)






// // stream.write(`>start {"formatid":"gen1randombattle"}`);
// // stream.write(`>player p1 {"name":"Alice"}`);
// // stream.write(`>player p2 {"name":"Bob"}`);

// stream.write(`>p1 move 1`);
// stream.write(`>p2 move 1`);





