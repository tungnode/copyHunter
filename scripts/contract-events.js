/*
A script that returns some filtered events from an Ethereum smart contract.

Your contract will require a solidity event and it will need to be triggered at least once before you run the script.

For an explanation of this code, navigate to the wiki https://github.com/ThatOtherZach/Web3-by-Example/wiki/Getting-Smart-Contract-Events
*/

// Add the web3 node module
var Web3 = require('web3');

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

// Search the contract events for the hash in the event logs and show matching events.
contract.getPastEvents('Transfer', {
    fromBlock: 12140000 ,
    toBlock: 'latest'
}, function(error, events){ 
	const numberOfEvent = events.length;
	console.log(numberOfEvent); 
	events.forEach(singleEvent => {console.log(singleEvent.returnValues.tokenId)})
})


contract.events.allEvents({
	
	fromBlock: 0
}, function (error, event) { console.log(event); })
	.on("connected", function (subscriptionId) {
		console.log(subscriptionId);
	})
	.on('data', function (event) {
		console.log(event); // same results as the optional callback above
	})
	.on('changed', function (event) {
		// remove event from local database
	})
	.on('error', function (error, receipt) { // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
    
	});

// event output example 
// 679368
679523
679579
679629
679647
679696
679678
679715
679484
679759
679849
660661
679946
614414
679978
679935
275977
679865