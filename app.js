'use strict';

const fs = require('fs');
const Web3 = require('web3')
const {Firestore} = require('@google-cloud/firestore');

// TODO pull out into settings file
var infura_project_id = ""
let post_factory_abi = JSON.parse(fs.readFileSync('post_factory_abi.json'));
let post_factory_genesis_block_num = 8411564;
let post_factory_address = "0x480b8d6b5C184C0E34AE66036cC5B4e0390EcA8A"

const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + infura_project_id))

// Create a new firestore client
const firestore = new Firestore();

const express = require('express');

const app = express();

const LOG_FETCH_COUNT = 250;

app.get('/', (req, res) => {
	res.status(200).send('{}').end();
});

async function get_last_fetched_block() {
	var last_fetched_block_doc_ref = firestore.doc('settings/state');

	var last_fetched_block_num = post_factory_genesis_block_num

	let last_fetched_block_doc = await last_fetched_block_doc_ref.get();

	if (last_fetched_block_doc.exists) {
		last_fetched_block_num = last_fetched_block_doc.get("last_fetched_block")
	}

	return {
		"last_fetched_block_doc_ref" : last_fetched_block_doc_ref,
		"last_fetched_block" : last_fetched_block_num
	}
}

async function update_last_fetched_block(last_fetched_block_doc_ref, last_fetched_block) {
	console.log("Updating last fetched block to " + last_fetched_block)

	await last_fetched_block_doc_ref.set({
	    "last_fetched_block" : last_fetched_block
	});
}

app.get('/task/refresh', (req, res) => {
  	get_last_fetched_block().then(function(data) {
  
  		web3.eth.getBlockNumber(function(error, current_block){ 
		  if (error === null) {		    	
		    	var fetch_to_block = data.last_fetched_block + LOG_FETCH_COUNT;

		    	// don't fetch up to the very latest block
		    	fetch_to_block = Math.min(fetch_to_block, current_block - 10)

		    	console.log("Fetching logs from block " + data.last_fetched_block + " to " + fetch_to_block + "...")

		    	var post_factory_contract = new web3.eth.Contract(post_factory_abi, post_factory_address);	    	

				post_factory_contract.getPastEvents('ExplicitInitData', {
				    filter: {},
				    fromBlock : data.last_fetched_block,
					toBlock :   fetch_to_block
				}, function(error, logs){ 
					if (error === null) {
						for (var i = 0; i < logs.length; i++) {
						
							var eventLog = logs[i]
						
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

					update_last_fetched_block(data.last_fetched_block_doc_ref, fetch_to_block + 1).then(function() {
						res.status(200).send('{}').end();
						console.log("Done");
					})
				});
			} else {
				console.log(error)
			}
		});	  
  	})
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
// [END gae_node_request_example]

module.exports = app;