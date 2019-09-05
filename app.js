'use strict';

const fs = require('fs');
const Web3 = require('web3')

// TODO pull out into settings file
var infura_project_id = "xxx"
let post_factory_abi = JSON.parse(fs.readFileSync('post_factory_abi.json'));
let post_factory_genesis_block = 8411564;
let post_factory_address = "0x480b8d6b5C184C0E34AE66036cC5B4e0390EcA8A"

const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + infura_project_id))

const express = require('express');

const app = express();

const LOG_FETCH_COUNT = 250;

app.get('/', (req, res) => {
	web3.eth.getBlockNumber(function(error, latest_block){ 
	  if (error === null) {
	  		// TODO load last fetched block from firestore
	    	var last_fetched_block = post_factory_genesis_block;
	    	
	    	var fetch_to_block = last_fetched_block + LOG_FETCH_COUNT;

	    	// don't fetch up to the very latest block
	    	fetch_to_block = Math.min(fetch_to_block, latest_block - 10)

	    	console.log("Fetching logs from block " + last_fetched_block + " to " + fetch_to_block + "...")

	    	var post_factory_contract = new web3.eth.Contract(post_factory_abi, post_factory_address);	    	

			post_factory_contract.getPastEvents('ExplicitInitData', {
			    filter: {},
			    fromBlock : last_fetched_block,
				toBlock :   fetch_to_block
			}, function(error, logs){ 
				if (error === null) {
					for (var i = 0; i < logs.length; i++) {
					
						var eventLog = logs[i]
					
						// console.log(eventLog)
					
						var operator = eventLog.returnValues.operator;
						var proof_hash = eventLog.returnValues.proofHash;
						var static_metadata = eventLog.returnValues.staticMetadata;
						var variable_metadata = eventLog.returnValues.variableMetadata;
						var blockNumber = eventLog.blockNumber;

						console.log(blockNumber)

						// TODO kick off a processing task which looks up the metadata on IPFS
						// TODO kick off a tweet task
					}

					// TODO store the fetch_to_block in datastore here
				} else {
					console.log(error);
				}
			});
		}

		res.status(200).send('{}').end();
	});	  
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
// [END gae_node_request_example]

module.exports = app;