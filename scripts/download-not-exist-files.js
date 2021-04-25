

// Add the web3 node module
var Web3 = require('web3');
const util = require('util');
const Stream = require('stream')
const createClient = require('ipfs-http-client')
const axios = require('axios');
const https = require('https')
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

var tokenOwnersFile = "./owners_data.json";
var tokenOwnersObj = JSON.parse(fs.readFileSync(tokenOwnersFile));

var nonExistTokenFile = "./nonExistTokens.json";
var nonexistTokens = JSON.parse(fs.readFileSync(nonExistTokenFile));
(async () => {

	let queryToken = [];
	for (let key in tokenOwnersObj) {

		if(nonexistTokens[key]){
			continue;
		}

		queryToken.push(key);
		if (queryToken.length < 1000) {
			continue;
		}

		const events = await contract.getPastEvents('Transfer', {

			fromBlock: 10000000,
			toBlock: 'latest',
			filter: { tokenId: queryToken }
		});
		const numOfEvent = events.length;
		console.log(numOfEvent);
		const processingToken = {}
		for (const event of events) {
			const tokenId = event.returnValues.tokenId;
			processingToken[tokenId] = tokenId;
			let owners = tokenOwnersObj[tokenId];
			if (!owners || Array.isArray(owners)) {
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

			if (!isDownloaded(tokenId)) {
				await downloadFile(tokenId)
			}

		}
		if (processingToken.length < 10) {
			console.log("===========================================", processingToken)
		}
		queryToken = [];

	}

	fs.writeFileSync(tokenOwnersFile, JSON.stringify(tokenOwnersObj))
	fs.writeFileSync(nonExistTokenFile, JSON.stringify(nonexistToken))

})();

const downloadFile = async (tokenId) => {
	ipfsClient = createClient("https://ipfs.io")
	try{
		const tokenMetaDataURI = await contract.methods.tokenURI(tokenId).call();
		let tokenMetaData = ''
		if (tokenMetaDataURI.includes('http'))
			tokenMetaData = await axios.request(tokenMetaDataURI);
		else {
			try{
				tokenMetaData = await axios.get('https://ipfs.io/' + tokenMetaDataURI.slice(tokenMetaDataURI.indexOf(':')+3));

			}catch(e){
				tokenMetaData = await axios.get('https://dweb.link/' + tokenMetaDataURI.slice(tokenMetaDataURI.indexOf(':')+3));

			}
			// https.get('https://ipfs.io/' + tokenMetaDataURI.slice(tokenMetaDataURI.lastIndexOf("ipfs")),res =>{
			// 	tokenMetaData = res;
			// })
		}
	
		const imageData = getImageData(tokenMetaData.data.image)
		if (imageData) {
			const imageName = imageData[1];
			const imageURI = imageData[0];
			
			try {
				//catting image from ipfs network
				console.log(imageURI)
				const finished = util.promisify(Stream.finished);
				const imageNameType = imageName.split(".")
				const imageType = imageNameType.length===2?"."+imageNameType[1]:"";
				var writableStream = fs.createWriteStream("./images/" + addr+"_"+tokenId + imageType, { flags: 'wx' });
				writableStream.on('error', (err) => { console.log(tokenId + " file already exist"); writableStream.end(); })
	
				writableStream.on('open', async () => {
					try {
						const res = ipfsClient.cat(imageURI, { "headers": { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } });
						for await (const chunk of res) {
							writableStream.write(chunk)
						}
	
					} catch (e) {
						console.log(e)
					} finally {
						writableStream.end(); // (C)
					}
	
				})
	
				// Wait until done. Throws if there are errors.
				await finished(writableStream);
	
	
			} catch (e) {
				console.log(e);
	
			}
	
		}
	}catch(err){
		if(err.message && err.message.includes('URI query for nonexistent token')){
			console.log('token does not exist')
			nonexistTokens[tokenId] = tokenId;
			fs.writeFileSync(nonExistTokenFile, JSON.stringify(nonexistTokens))

		}else{
			console.log(err)
		}
	}
	
}
const isDownloaded = (tokenId) => {
	const fileName = addr + "_" + tokenId;
	const fileNameList = []
	fileNameList.push(fileName)
	fileNameList.push(fileName + ".jpeg");
	fileNameList.push(fileName + ".png");
	fileNameList.push(fileName + ".jpg");
	fileNameList.push(fileName + ".gif");
	const dirList = []
	dirList.push('./images_25k/');
	dirList.push('./images_50k/');
	dirList.push('./images/');
	for (folder of dirList) {
		for (file of fileNameList) {
			if (fs.existsSync(folder + file)) {
				return true;
			}

		}
	}
	return false;
};

function renameThenPolulateMap(directory) {
	fs.readdir(directory, async function (err, files) {
		if (err) {
			return console.log('Unable to scan directory: ' + err);
		}
		for (file of files) {
			const tokenId = file.split("_")[0];
			const nameExtension = file.split(".");
			let newName = addr + "_" + tokenId
			if (nameExtension.length === 2) {
				newName = newName + "." + nameExtension[1]
			}
			console.log(newName)
			fs.renameSync(directory + file, directory + newName)

		}
	});
}


const getImageData = (imageURI) => {
	if(!imageURI || imageURI.includes('.webp') || imageURI.includes('.gif') || imageURI.includes('.mp4'))
			return;
	var pos = imageURI.indexOf("ipfs");
	if (pos >= 0) {
		imageURI = imageURI.slice(imageURI.lastIndexOf("ipfs") + 5);
		console.log(imageURI);
		const imageName = imageURI.slice(imageURI.indexOf("/") + 1);
		return [imageURI, imageName];
		
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


