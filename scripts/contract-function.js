/*
A script that gets runs a function call in a smart contract on Ethereum. This script will probably not work on payable or not constant solidity functions. Use at your own risk. 

Currently this script is set up to call the "Ebola on Ethereum" smart contract. For more info on that see the repo here: https://github.com/ThatOtherZach/Ebola-on-Ethereum

For an explanation of this code, navigate to the wiki https://github.com/ThatOtherZach/Web3-by-Example/wiki/contract-function
*/

// Require Web3 Module
var Web3 = require('web3');
const Stream = require('stream')
const https = require('https');
// Show web3 where it needs to look for the Ethereum node
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/a671a77998514426b1ca3733157fb5ab'));

// Write to the console the script will run shortly
console.log('Contract-ing Ebola.....');

// Define the ABI of the contract, used to return the desired values
var fs = require('fs');
var jsonFile = "..\\contracts\\Rarible.json";
var parsed = JSON.parse(fs.readFileSync(jsonFile));
var abi = parsed.abi;
// The Ethereum address of the smart contract
var addr = "0x60f80121c31a0d46b5279700f9df786054aa5ee5";

// Build a new variable based on the web3 API including the ABI and address of the contract
var contract = new web3.eth.Contract(abi, addr);


/**
* @template T
* @param {(AsyncIterable<T> & { return?: () => {}}) | AsyncGenerator<T, any, any>} source
* @returns {ReadableStream<T>}
*/
const toReadableStream = (source) => {
  const iterator = source[Symbol.asyncIterator]()
  return new NodeJS.ReadableStream({
    /**
     * @param {ReadableStreamDefaultController} controller 
     */
    async pull(controller) {
      try {
        const chunk = await iterator.next()
        if (chunk.done) {
          controller.close()
        } else {
          controller.enqueue(chunk.value)
        }
      } catch (error) {
        controller.error(error)
      }
    },
    /**
     * @param {any} reason 
     */
    cancel(reason) {
      if (source.return) {
        source.return(reason)
      }
    }
  })
}

async function saveFile(imageURI, imageName) {
  const ipfsClient = require('ipfs-http-client')
  const ipfs = ipfsClient("https://ipfs.io")
  var writableStream = fs.createWriteStream("./images/"+imageName);
  const stream = ipfs.cat(imageURI, { "headers": { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } })
  for await (const chunk of stream) {
    writableStream.write(chunk);
  }

}




function saveTokenImages(tokenId,url) {
  https.get(url, (resp) => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      let imageURI = JSON.parse(data).image;
      console.log(imageURI);
      var pos = imageURI.indexOf("ipfs");
      if (pos >= 0) {
        imageURI = imageURI.slice(imageURI.lastIndexOf("ipfs") + 5);
        console.log(imageURI);
        const imageName = imageURI.slice(imageURI.indexOf("/") + 1);
        saveFile(imageURI, tokenId+imageName);
      }
    });

  }).on("error", (err) => {
    console.log("Error: " +tokenId + ":"+ err.message);
  });
}

// Search the contract events for the hash in the event logs and show matching events.
contract.getPastEvents('Transfer', {
  fromBlock: 12141000,
  toBlock: 'latest'
}, function (error, events) {
  const numberOfEvent = events.length;
  console.log(numberOfEvent);
  events.forEach(singleEvent => {
    console.log(singleEvent.returnValues.tokenId)
    contract.methods.tokenURI(singleEvent.returnValues.tokenId).call(function (err,output) {
      if(err){console.log(err)}
      else{
        console.log(output);
        saveTokenImages(singleEvent.returnValues.tokenId,output);  
      }
    });
  })
})

function handleEvent(transferEvent){
    console.log(transferEvent.returnValues.tokenId)
    contract.methods.tokenURI(transferEvent.returnValues.tokenId).call().then(function (output) {

      console.log(output);
      saveTokenImages(transferEvent.returnValues.tokenId,output);
    });
}
// const secondTokenId = [614414]
// // const tokenId = "678184"
// secondTokenId.forEach(token =>{
//   console.log(token);
//   contract.methods.tokenURI(token).call(function (err,output) {
//     if(err){
//       console.log(err);
//     }
//     else
//       console.log(output);
//     // saveTokenImages(tokenId,output);
//   });
// })
