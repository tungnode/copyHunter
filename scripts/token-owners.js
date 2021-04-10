/*
A script that returns some filtered events from an Ethereum smart contract.

Your contract will require a solidity event and it will need to be triggered at least once before you run the script.

For an explanation of this code, navigate to the wiki https://github.com/ThatOtherZach/Web3-by-Example/wiki/Getting-Smart-Contract-Events
*/

// Add the web3 node module
var Web3 = require('web3');
const util = require('util');
const Stream = require('stream')

// Show web3 where it needs to look for the Ethereum node.
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/a671a77998514426b1ca3733157fb5ab'));

// The address we want to search by.
var addr = "0x60f80121c31a0d46b5279700f9df786054aa5ee5";

// Show the Hash in the console.
console.log('Events by Address: ' + addr);

// Define the contract ABI
var fs = require('fs');
var jsonFile = "..\\contracts\\Rarible.json";
var parsed = JSON.parse(fs.readFileSync(jsonFile));
var abi = parsed.abi;

// Define the contract ABI and Address
var contract = new web3.eth.Contract(abi, addr);

// Fun console text, you can ignore this.
console.log('-----------------------------------');
console.log('Matching Smart Contract Events');
console.log('-----------------------------------');

let toBlock = 12157600;
let savedImages = 0;

var tokenOwnersFile = "./owners_data.json";
var tokenOwnersObj = {};//JSON.parse(fs.readFileSync(tokenOwnersFile));

(async () => {
	fs.readdir('./images/', async function (err, files) {
		//handling error
		if (err) {
			return console.log('Unable to scan directory: ' + err);
		}
		//listing all files using forEach
		let queryToken = [];
		const numberOfFiles = files.length;
		for(let index = 0;index<numberOfFiles;index++){
			// Do whatever you want to do with the file
			console.log(files[index]);
			const tokenId = files[index].split("_")[0];
			// if(!tokenOwnersObj.hasOwnProperty(tokenId)){
				queryToken.push(tokenId);
				if (queryToken.length < 100) {
					continue;
				}
				console.log(queryToken);
				const events = await contract.getPastEvents('Transfer', {
	
					fromBlock: 0,
					toBlock: 'latest',
					filter: { tokenId: queryToken }
				});
				const numOfEvent = events.length;
				console.log(numOfEvent);
				const processingToken = {}
				for (let eventIndex = 0; eventIndex < numOfEvent; eventIndex++) {
					const event = events[eventIndex];
					const tokenId = event.returnValues.tokenId;
					processingToken[tokenId] = tokenId;
					let owners = tokenOwnersObj[tokenId];
					if(!owners){
						owners = {};
					}
					const from = event.returnValues.from;
					const to = event.returnValues.to
					if ("0x0000000000000000000000000000000000000000" !== from) {
						owners[event.returnValues.from] = event.returnValues.from
					}
					if ("0x0000000000000000000000000000000000000000" !== to) {
						owners[event.returnValues.to] = event.returnValues.to
					}
					tokenOwnersObj[tokenId] = owners;
	
				}
				if(processingToken.length<10){
					console.log("===========================================",processingToken)
				}
				queryToken = [];
			// }else{
			// 	console.log(tokenId)
			// }
			

			
		}
		fs.writeFileSync(tokenOwnersFile, JSON.stringify(tokenOwnersObj))
	});


})();



// Search the contract events for the hash in the event logs and show matching events.
// contract.getPastEvents('Transfer', {

// 	fromBlock: 0,
// 	toBlock: 12157600,
// 	filter: { tokenId: "180481" }
// }, function (error, events) {
// 	const numberOfEvent = events.length;
// 	console.log(numberOfEvent);
// 	events.forEach(async singleEvent => {
// 		console.log(singleEvent)
// 		const tokenImageURI = await contract.methods.tokenURI(singleEvent.returnValues.tokenId).call();
// 		console.log(singleEvent);





// 		// Wait until done. Throws if there are errors.
// 	})
// })
const getImageData = (imageURI) => {

	var pos = imageURI.indexOf("ipfs");
	if (pos >= 0) {
		imageURI = imageURI.slice(imageURI.lastIndexOf("ipfs") + 5);
		// console.log(imageURI);
		const imageName = imageURI.slice(imageURI.indexOf("/") + 1);
		if (imageName.search(".gif") > 0) {
			return;
		} else {
			return [imageURI, imageName];
		}
	}

}


function saveOwnerToFile(ownersData) {
	const jsonPath = ("./owners_data.json");
	const fileObj = fs.readFileSync(jsonPath, { flag: "a+" });
	let jsonObj = {};
	if (fileObj.byteLength != 0) {
		jsonObj = JSON.parse(fileObj);
	}

	let owners = {}
	let tokenExist = false;
	const tokenId = ownersData.tokenId;
	if (jsonObj.hasOwnProperty(tokenId)) {
		owners = jsonObj[tokenId];
		tokenExist = true;
	}
	owners[ownersData['to']] = ownersData['to'];
	owners[ownersData['from']] = ownersData['from'];
	jsonObj[tokenId] = owners
	fs.writeFileSync(jsonPath, JSON.stringify(jsonObj));
	return tokenExist;
}
// contract.events.allEvents({

// 	fromBlock: 0
// }, function (error, event) { console.log(event); })
// 	.on("connected", function (subscriptionId) {
// 		console.log(subscriptionId);
// 	})
// 	.on('data', function (event) {
// 		console.log(event); // same results as the optional callback above
// 	})
// 	.on('changed', function (event) {
// 		// remove event from local database
// 	})
// 	.on('error', function (error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.

// 	});
// // "https://ipfs.2read.net",
// // "https://ninetailed.ninja"


// "https://gateway.pinata.cloud",
// 	"https://ipfs.drink.cafe",
// 	"https://ipfs.io",
// 	"https://gateway.ipfs.io",

// 	"https://ipfs.infura.io:5001"


