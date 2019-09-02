'use strict';

const Web3 = require('web3')

// TODO pull out into settings file
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/xxx'))

const express = require('express');
const fs = require('fs');
const app = express();

// TODO pull out into settings file
let post_factory_abi = JSON.parse(fs.readFileSync('post_factory_abi.json'));
let post_factory_address = "0x480b8d6b5C184C0E34AE66036cC5B4e0390EcA8A"

app.get('/', (req, res) => {
	var myContract = new web3.eth.Contract(post_factory_abi, post_factory_address);

	myContract.getPastEvents('ExplicitInitData', {
	    filter: {},
	    fromBlock : 8467714,
		toBlock : 8467715
	}, function(error, logs){ 
		for (var i = 0; i < logs.length; i++) {
			var eventLog = logs[i]

			console.log(eventLog.returnValues.operator)
			console.log(eventLog.returnValues.staticMetadata)
			// console.log(typeof eventLog.returnValues.proofHash)
			var staticMetaData = web3.utils.hexToBytes(eventLog.returnValues.staticMetadata);
			
			// console.log(web3.utils.hexToString(eventLog.returnValues.staticMetadata));
			// console.log(web3.utils.hexToAscii(eventLog.returnValues.staticMetadata));
			console.log(web3.utils.hexToBytes(eventLog.returnValues.staticMetadata));
			// console.log(web3.utils.hexToString(eventLog.returnValues.proofHash))
			// console.log(web3.utils.hexToAscii(eventLog.returnValues.proofHash))
			// console.log(web3.utils.hexToUtf8(eventLog.returnValues.staticMetadata))
			// console.log(eventLog.returnValues.variableMetadata)
		}
	});

  res.status(200).send('Hello, world!').end();
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
// [END gae_node_request_example]

module.exports = app;
