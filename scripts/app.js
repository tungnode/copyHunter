
var Web3 = require('web3');
const Stream = require('stream')
const https = require('https');
const pLimit = require('p-limit');
const all = require("it-all")
const axios = require('axios');
const util = require('util');
const once = require('events')
const Tar = require('it-tar')
var fs = require('fs');
const createClient = require('ipfs-http-client')

// Show web3 where it needs to look for the Ethereum node
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/a671a77998514426b1ca3733157fb5ab'));

// Define the ABI of the contract, used to return the desired values
var jsonFile = "..\\contracts\\Rarible.json";
var parsed = JSON.parse(fs.readFileSync(jsonFile));
var abi = parsed.abi;

// The Ethereum address of the smart contract
var addr = "0x60f80121c31a0d46b5279700f9df786054aa5ee5";

// Build a new variable based on the web3 API including the ABI and address of the contract
var contract = new web3.eth.Contract(abi, addr);


const ipfsGateways = loadIPFSGateways();
const ipfsClients = [];
for (let gateway of ipfsGateways) {
  ipfsClients.push(createClient(gateway))
}
// ipfsClients.push(createClient())
//rarible: from 11083600 to 12157600 12274312
let toBlock = 11083600;// from 11703600 to 12157600
let savedImages = 0;
let totalImages = 0;
let totalFailed = 0;
let totalIgnored = 0;
(async () => {
  while (toBlock > 10583600) {
    const eventsList = []
    for (let gwIndex in ipfsClients) {
      const fromBlock = toBlock - 1000
      //get all transfer events from block xxx to block xxx
      const events = await contract.getPastEvents('Transfer', {
        fromBlock: fromBlock,
        toBlock: toBlock
      });
      eventsList.push(events);
      toBlock = fromBlock;
    }


    const processingEventList = []
    for (let index in eventsList) {
      processingEventList.push(processEvents(ipfsClients[index], eventsList[index], ipfsGateways[index]))
    }
    await Promise.all(processingEventList);
  }
  console.log("^^^^^^^^^^^^^^^^^  all done  ^^^^^^^^^^^^^^^^^^^^^^^")
})();




/**
 * check if tokenId is already in owners_data.json file
 * return true. else false. It also updats new owners of that token
 * @param {object} ownersData 
 * @returns 
 */
function isTokenExist(ownersData) {
  const jsonPath = ("./owners_data.json");
  const fileObj = fs.readFileSync(jsonPath, { flag: "a+" });
  let jsonObj = {};
  if (fileObj.byteLength != 0) {
    jsonObj = JSON.parse(fileObj);
  }

  let owners = []
  let tokenExist = false;
  const tokenId = ownersData.tokenId;
  if (jsonObj.hasOwnProperty(tokenId)) {
    owners = jsonObj[tokenId];
    tokenExist = true;
  }
  owners[ownersData.from] = ownersData.from;
  owners[ownersData.to] = ownersData.to;
  jsonObj[tokenId] = owners;
  fs.writeFileSync(jsonPath, JSON.stringify(jsonObj));
  return tokenExist;
}

/**
 * extract image name and ipfs uri from https uri. For example http://ipfs/QmbPLPwV4tqNriFcvPQ2Dkrf2GVzr8P3GANUn9EN75BBvi
 * @param {http url which contains ipfs uri} imageURI 
 * @returns 
 */
const getImageData = (imageURI) => {
  var pos = imageURI.indexOf("ipfs");
  if (pos >= 0) {
    imageURI = imageURI.slice(imageURI.lastIndexOf("ipfs") + 5);
    console.log(imageURI);
    const imageName = imageURI.slice(imageURI.indexOf("/") + 1);
    if (imageName.search(".gif") > 0) {
      return;
    } else {
      return [imageURI, imageName];
    }
  }
}

/**
 * process transfer events
 * @param {*} ipfs 
 * @param {*} events 
 * @param {*} gtway 
 */
async function processEvents(ipfs, events, gtway) {
  const possibleNumberEvents = events.length;
  console.log(possibleNumberEvents);
  let timeout = 0;
  totalImages = totalImages + possibleNumberEvents;
  for (let i = 0; i < possibleNumberEvents; i++) {
    const singleEvent = events[i];
    const tokenId = singleEvent.returnValues.tokenId;
    console.log("=======================================================================================================")
    console.log("=====Started", i, "out of:", possibleNumberEvents, "on Gateway:", gtway, "=== token:", tokenId, "Block number:", singleEvent.blockNumber)
    console.log("=======================================================================================================")

    if (isTokenExist({ "tokenId": tokenId, "from": singleEvent.returnValues.from, "to": singleEvent.returnValues.to })) {
      console.log("============",tokenId,"already exist")
      savedImages++;
      continue;
    }

    if (timeout > 2500) {
      timeout = 500;
    } else {
      timeout = timeout + 500;
    }
    //wait so won't cause server timeout
    await wait(timeout);

    try {
      //
      const tokenMetaDataURI = await contract.methods.tokenURI(tokenId).call();
      let tokenMetaData = ''
      if (tokenMetaDataURI.includes('http'))
        tokenMetaData = await axios.request(tokenMetaDataURI);
      else {
        tokenMetaData = await axios.request('http://ipfs.io/' + tokenMetaDataURI.slice(tokenMetaDataURI.lastIndexOf("ipfs")));
      }

      const imageData = getImageData(tokenMetaData.data.image)
      if (imageData) {
        const imageName = imageData[1];
        const imageURI = imageData[0];

        console.log("=======================================================================================================")
        console.log("=====Catting", i, "out of:", possibleNumberEvents, "on Gateway:", gtway, "=== token:", tokenId, "Block number:", singleEvent.blockNumber)
        console.log("=======================================================================================================")

        try {
          //catting image from ipfs network
          console.log(imageURI)
          const finished = util.promisify(Stream.finished);
          var writableStream = fs.createWriteStream("./images/" + tokenId + "_" + imageName, { flags: 'wx' });
          writableStream.on('error', (err) => { console.log(tokenId + " file already exist"); writableStream.end(); })

          writableStream.on('open', async () => {
            try {
              const res = ipfs.cat(imageURI, { "headers": { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } });
              for await (const chunk of res) {
                writableStream.write(chunk)
              }
              
            } catch (e) {
              console.log(e)
              saveRetryInfo({ 'tokenId': tokenId, 'tokenMetaURI': tokenMetaDataURI, 'imageURL': imageURI, 'imageName': imageName })
              const downloadFileTimeout = 10 * 1000
              console.log('Waiting', downloadFileTimeout, 'ms');
              totalFailed++;
              await wait(downloadFileTimeout);
            }finally{
              writableStream.end(); // (C)
            }

          })

          // Wait until done. Throws if there are errors.
          await finished(writableStream);
          savedImages++;
          console.log("=======================================================================================================")
          console.log("=====Saved", i, "out of:", possibleNumberEvents, "on Gateway:", gtway, "=== token:", tokenId, "Block number:", singleEvent.blockNumber)
          console.log("=====Saved", savedImages, "out of total:", totalImages, "on Gateway:", gtway, "=== token:", tokenId, "Block number:", singleEvent.blockNumber)
          console.log("=======================================================================================================")

        } catch (e) {
          console.log(e);
          if (e.code !== 'EEXIST') {
            saveRetryInfo({ 'tokenId': tokenId, 'tokenMetaURI': tokenMetaDataURI, 'imageURL': imageURI, 'imageName': imageName })
            const downloadFileTimeout = 10 * 1000
            console.log('Waiting', downloadFileTimeout, 'ms');
            totalFailed++;
            await wait(downloadFileTimeout);
          }

        }




      } else {
        totalIgnored++;
      }
    } catch (err) {
      console.log(err)
      if(err.message && err.message.includes('URI query for nonexistent token')){
        console.log("==============",tokenId,"nonexistent")
      }else{
        saveRetryInfo({ 'tokenId': tokenId });
        await wait(timeout);
        totalFailed++
      }
      
    }
    console.log("=======================================================================================================")
    console.log("=====End", i, "out of:", possibleNumberEvents, "on Gateway:", gtway, "=== token:", tokenId, "Block number:", singleEvent.blockNumber)
    console.log("=======================================================================================================")



  }

  console.log("=====Saved", savedImages, "out of total:", totalImages, "with total failed: ", totalFailed, "and total ignored:", totalIgnored)

}



function saveRetryInfo(tokenInfo) {
  const jsonPath = ("./retryInfo.json");
  const fileObj = fs.readFileSync(jsonPath, { flag: "a+" });
  let jsonObj = {};
  if (fileObj.byteLength != 0) {
    jsonObj = JSON.parse(fileObj);
  }

  const tokenId = tokenInfo.tokenId;
  if (!jsonObj.hasOwnProperty(tokenId)) {
    jsonObj[tokenId] = tokenInfo;
    fs.writeFileSync(jsonPath, JSON.stringify(jsonObj));
  }

}

function wait(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout);
  });
}

function loadIPFSGateways() {
  const gatewayFile = ".\\ipfs-gateways.json";
  return JSON.parse(fs.readFileSync(gatewayFile));
}


