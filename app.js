'use strict';

const fs = require('fs');
const {Firestore} = require('@google-cloud/firestore');
const firestore = new Firestore();

const Twitter = require('twitter');
// const twitter_client = new Twitter(JSON.parse(fs.readFileSync('twitter_credentials.json')));

// TODO pull out into settings file
var infura_project_id = ""
let wmc_card_abi = JSON.parse(fs.readFileSync('wmc_card_abi.json'));
let wmc_card_genesis_block_num = 8151030;
let wmc_card_address = "0x8AedB297FED4b6884b808ee61fAf0837713670d0"

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + infura_project_id))

const express = require('express');
const app = express();

const LOG_FETCH_COUNT = 250;

const modeType = {
    DEPOSIT: 'deposits',
    BURN: 'burns'
}

app.get('/', (req, res) => {
	res.status(200).send('{}').end();
});

async function get_last_fetched_block(mode) {
	var last_fetched_block_doc_ref = firestore.doc('settings/' + mode);

	var last_fetched_block_num = wmc_card_genesis_block_num

	let last_fetched_block_doc = await last_fetched_block_doc_ref.get();

	if (last_fetched_block_doc.exists) {
		last_fetched_block_num = last_fetched_block_doc.get("last_fetched_block")
	}

	last_fetched_block_num = 8695229; // TODO Remove

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

app.get('/task/tweet', (req, res) => {	
	var tweet_status = req.query.status;
	if (tweet_status !== undefined) {
		// TODO
		// twitter_client.post('statuses/update', {status: req.query.status}, function(error, tweet, response) {
		//   	if(error) {
		//   		console.log(error)
		//   	} else {  			
  // 				console.log(tweet);  // Tweet body.
		//   		console.log(response);  // Raw response object.
		//   	}
		// });
	} else {
		console.log("No tweet status found!")
	}

	res.status(200).send('{}').end();
})

app.get('/task/refresh/burns', (req, res) => {
  	get_last_fetched_block(modeType.BURN).then(function(data) {  
  		web3.eth.getBlockNumber(function(error, current_block){ 
		  if (error === null) {
		    	var fetch_to_block = data.last_fetched_block + LOG_FETCH_COUNT;

		    	// don't fetch up to the very latest block
		    	fetch_to_block = Math.min(fetch_to_block, current_block - 10)

		    	console.log("Fetching logs from block " + data.last_fetched_block + " to " + fetch_to_block + "...")

		    	var wmc_card_contract = new web3.eth.Contract(wmc_card_abi, wmc_card_address);	    	

				wmc_card_contract.getPastEvents('BurnTokenAndWithdrawCard', {
				    filter: {},
				    fromBlock : data.last_fetched_block,
					toBlock :   fetch_to_block
				}, function(error, logs){ 
					if (error === null) {
						for (var i = 0; i < logs.length; i++) {
							var eventLog = logs[i]

							var cardId = eventLog.returnValues.cardId;

							console.log(cardId + " Burned")							

							// TODO kick off a processing task which looks up the metadata on IPFS
							// TODO kick off a tweet task
						}
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

app.get('/task/refresh/deposits', (req, res) => {
  	get_last_fetched_block(modeType.DEPOSIT).then(function(data) {  
  		web3.eth.getBlockNumber(function(error, current_block){ 
		  if (error === null) {
		    	var fetch_to_block = data.last_fetched_block + LOG_FETCH_COUNT;

		    	// don't fetch up to the very latest block
		    	fetch_to_block = Math.min(fetch_to_block, current_block - 10)

		    	console.log("Fetching logs from block " + data.last_fetched_block + " to " + fetch_to_block + "...")

		    	var wmc_card_contract = new web3.eth.Contract(wmc_card_abi, wmc_card_address);	    	

				wmc_card_contract.getPastEvents('DepositCardAndMintToken', {
				    filter: {},
				    fromBlock : data.last_fetched_block,
					toBlock :   fetch_to_block
				}, function(error, logs){ 
					if (error === null) {
						for (var i = 0; i < logs.length; i++) {
							var eventLog = logs[i]
						
							var cardId = eventLog.returnValues.cardId;

							console.log(cardId + " Deposited")							

							// TODO kick off a processing task which looks up the metadata on IPFS
							// TODO kick off a tweet task
						}
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