'use strict';

const Web3 = require('web3')

const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/xxx'))

// [START gae_node_request_example]
const express = require('express');
const fs = require('fs');

const app = express();

app.get('/', (req, res) => {	
	let rawdata = fs.readFileSync('post_factory_abi.json');

	let abi = JSON.parse(rawdata);

	var myContract = new web3.eth.Contract(abi, "0x480b8d6b5C184C0E34AE66036cC5B4e0390EcA8A");

	myContract.getPastEvents('ExplicitInitData', {
	    filter: {
	    	
	    },
	    fromBlock : 8418528,
		toBlock : 8468529
	}, function(error, events){ console.log(events); })
	.then(function(events){
	    console.log(events)
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
