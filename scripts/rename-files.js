const fs = require('fs')
var addr = "0x60f80121c31a0d46b5279700f9df786054aa5ee5";

renameThenPolulateMap("./images/")



function renameThenPolulateMap(directory){
	fs.readdir(directory, async function (err, files){
		if(err){
			return console.log('Unable to scan directory: ' + err);
		}
		for(file of files){
			const tokenId = file.split("_")[0];
			const nameExtention = file.split(".");
			let newName = addr+"_"+tokenId
			if(nameExtention.length===2){
				newName = newName+"."+nameExtention[1]
			}
			console.log(newName)
			fs.renameSync(directory+file,directory+newName)
		}
	});
}