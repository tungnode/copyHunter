/*
A script that gets runs a function call in a smart contract on Ethereum. This script will probably not work on payable or not constant solidity functions. Use at your own risk. 

Currently this script is set up to call the "Ebola on Ethereum" smart contract. For more info on that see the repo here: https://github.com/ThatOtherZach/Ebola-on-Ethereum

For an explanation of this code, navigate to the wiki https://github.com/ThatOtherZach/Web3-by-Example/wiki/contract-function
*/

// Require Web3 Module
var Web3 = require('web3');
const Stream = require('stream')
const https = require('https');
const pLimit = require('p-limit');
const all = require("it-all")
const axios = require('axios');
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
let possibleNumberEvents = 0;
let savedImages = 0;



function saveOwnerToFile(ownersData) {
  const jsonPath = ("../../imagematch/owners_data.json");
  const fileObj = fs.readFileSync(jsonPath, { flag: "a+" });
  let jsonObj = {};
  if (fileObj.byteLength != 0) {
    jsonObj = JSON.parse(fileObj);
  }

  let owners = []
  const tokenId = ownersData.tokenId;
  if (jsonObj.hasOwnProperty(tokenId)) {
    owners = jsonObj[tokenId];
  }
  owners.push(ownersData);
  jsonObj[tokenId] = owners;
  fs.writeFileSync(jsonPath, JSON.stringify(jsonObj));
}

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


const ipfsClient = require('ipfs-http-client')
const ipfs = ipfsClient("https://ipfs.infura.io:5001")
// Search the contract events for the hash in the event logs and show matching events.
contract.getPastEvents('Transfer', {
  fromBlock: 12141000,
  toBlock: 'latest'
}, async function (error, events) {
  possibleNumberEvents = events.length;
  console.log(possibleNumberEvents);
  let timeoutCounter = 1;
  for (let i = 0; i < possibleNumberEvents; i++) {
    const singleEvent = events[i];
    const tokenId = singleEvent.returnValues.tokenId;
    console.log("starting: " + tokenId)

    const timeout = Math.pow(2, timeoutCounter);
    console.log('Waiting', timeout, 'ms');
    await wait(timeout);
    timeoutCounter++;
    if (timeoutCounter > 10) {
      timeoutCounter = 1;
    }
    try {
      const tokenImageURI = await contract.methods.tokenURI(tokenId).call();

      console.log(tokenImageURI);

      let tokenMetaData = await axios.request(tokenImageURI);

      console.log(tokenMetaData.data.image);

      const imageData = getImageData(tokenMetaData.data.image)
      if (imageData) {
        const imageName = imageData[1];
        const imageURI = imageData[0];

        var writableStream = fs.createWriteStream("./images/" + tokenId + "_" + imageName);
        console.log("Catting file: " + imageName)
        try {
          const stream = ipfs.cat(imageURI, { "headers": { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } });
          // console.log(stream);
          for await (const chunk of stream) {
            writableStream.write(chunk);
          }
          saveOwnerToFile({ "tokenId": tokenId, "from": singleEvent.returnValues.from, "to": singleEvent.returnValues.to });
          savedImages++;
          const logMsg = "Saved " + savedImages + " images out of " + possibleNumberEvents;
          console.log(logMsg)
        } catch (e) {
          console.log(e);
          const downloadFileTimeout = 10*1000
          console.log('Waiting', downloadFileTimeout, 'ms');
          await wait(downloadFileTimeout);
        }


      }
    } catch (err) {
      console.log(err)
      await wait(timeout);
    }



  }


})
function wait(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout);
  });
}



