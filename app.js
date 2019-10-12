'use strict';

const fs = require('fs');
const {Firestore} = require('@google-cloud/firestore');
const firestore = new Firestore();

const axios = require('axios')

const {v2beta3} = require('@google-cloud/tasks');
const task_client = new v2beta3.CloudTasksClient();
const task_parent = task_client.queuePath('erasure-feed', 'us-central1', 'my-queue');

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
var bodyParser = require('body-parser')

const app = express();

app.use(bodyParser.json())
app.use(bodyParser.raw({
    type: 'application/octet-stream',
    limit: '10mb'
}));

const LOG_FETCH_COUNT = 250;

const modeType = {
    DEPOSIT: 'deposits',
    BURN: 'burns'
}

function get_event_for_mode(mode) {
	if (mode === modeType.BURN) {
		return "BurnTokenAndWithdrawCard"
	} else if (mode === modeType.DEPOSIT) {
		return "DepositCardAndMintToken"
	}

	return null;
}

async function get_last_fetched_block(mode) {
	var last_fetched_block_doc_ref = firestore.doc('settings/' + mode);

	var last_fetched_block_num = wmc_card_genesis_block_num

	let last_fetched_block_doc = await last_fetched_block_doc_ref.get();

	if (last_fetched_block_doc.exists) {
		last_fetched_block_num = last_fetched_block_doc.get("last_fetched_block")
	}

	// last_fetched_block_num = 8697280; // TODO Remove

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

async function schedule_task(relative_uri, delay_in_seconds, payload) {
	let headers = new Map();
    headers.set("Content-Type", "application/json");    

    const task = {
        appEngineHttpRequest: {
            httpMethod: 'POST',
            relativeUri: relative_uri,
            headers: headers,
            body: Buffer.from(JSON.stringify(payload)).toString('base64')
        },
        scheduleTime : {
			seconds: delay_in_seconds + Date.now() / 1000,
    	}
    };
		
    const request = {
    	parent: task_parent,
    	task: task,
  	}

  	const [response] = await task_client.createTask(request);
  	const name = response.name;
  	
  	console.log('Created task ' + name)
}

function refresh_internal(mode, res) {
	get_last_fetched_block(mode).then(function(data) {  
  		web3.eth.getBlockNumber(function(error, current_block){ 
		  if (error === null) {
		    	var fetch_to_block = data.last_fetched_block + LOG_FETCH_COUNT;

		    	// don't fetch up to the very latest block
		    	fetch_to_block = Math.min(fetch_to_block, current_block - 10)

		    	console.log("Fetching logs from block " + data.last_fetched_block + " to " + fetch_to_block + "...")

		    	var wmc_card_contract = new web3.eth.Contract(wmc_card_abi, wmc_card_address);	    	

				wmc_card_contract.getPastEvents(get_event_for_mode(mode), {
				    filter: {},
				    fromBlock : data.last_fetched_block,
					toBlock :   fetch_to_block
				}, function(error, logs){ 
					if (error === null) {
						var delay_in_seconds = 30;
						var delay_between_process_in_seconds = 70; // give more than a minute between tweets

						for (var i = 0; i < logs.length; i++) {

							// build the payload
							var payload = {
								card_id : logs[i].returnValues.cardId,
								mode : mode
							}

							// kick off a processing task which looks up the card metadata 
							schedule_task('/task/process/card', delay_in_seconds, payload);

							delay_in_seconds += delay_between_process_in_seconds; 
						}
					} else {
						console.log(error);
					}

					// update the last fetched block and return
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
}

app.get('/', (req, res) => {
	res.status(200).send('{}').end();
});

const MAX_TITLE_LENGTH = 97;
const OPEN_SEA_REFERRAL = "Jack_Sparrow"

function clean_collection_name(collection) {
	var domains = [".com", ".gov", ".io"]

	// remove any domain suffixes to be cleaner
	for (var i = 0; i < domains.length; i++) {
		if (collection.endsWith(domains[i])) {
			collection = collection.substring(0, collection.length - domains[i].length)
			break	
		}
	}

	return collection;
}

app.post('/task/process/card', (req, original_res) => {
	if (Buffer.isBuffer(req.body)) {		
		req.body = JSON.parse(req.body)
	}
	
	var card_id = parseInt(req.body.card_id)
	
	var mode = req.body.mode
	
	console.log("Processing card: " + card_id)

	// fetch the card details from marble API
	var url = "https://ws.marble.cards/task/card_index/get_card_detail_task"

	axios.post(url, {
	  nft_id : card_id
	}).then((res) => {
	  console.log(res.data)	

	  var card_title = res.data.title;

	  // truncate the title down
	  if (card_title.length > MAX_TITLE_LENGTH) {
	  	card_title = card_title.substring(0, MAX_TITLE_LENGTH) + "..."
	  }

	  var card_level = res.data.level;
	  var card_id = res.data.nft_id;
	  var card_image_url = res.data.image_2k;

	  var collection = clean_collection_name(res.data.domain_collection.domain_name)
	  var collection_number = res.data.domain_collection.collection_number
	  var is_gold_card = res.data.domain_collection.is_gold_card;

	  var status_tokens = []

	  // append a different emoji if it was a deposit or burn event
	  if (mode == modeType.DEPOSIT) {
	  	status_tokens.push("🎁 \"")
	  }	else if (mode == modeType.BURN) {
	  	status_tokens.push("🔥 \"")
	  }

	  // append the title
	  status_tokens.push(card_title)
	  status_tokens.push("\"")

	  // append gold medal if so
	  if (is_gold_card) {
	  	status_tokens.push(" 🥇")
	  }
	  status_tokens.push("\n")

	  // append card id
	  status_tokens.push("🃏 #")
	  status_tokens.push(card_id)
	  status_tokens.push("\n")

	  // append card level
	  status_tokens.push("⚔️ ")
	  status_tokens.push(card_level)
	  status_tokens.push("\n")

	  // append collection and number
	  status_tokens.push("📋 ")
	  status_tokens.push(collection)
	  status_tokens.push(" #")
	  status_tokens.push(collection_number)
	  status_tokens.push("\n")
	  
	  // append link on how to get this card
	  status_tokens.push("🏦 ")

	  // if deposited, then go directly to wmc
	  if (mode == modeType.DEPOSIT) {
	  	status_tokens.push("https://wrappedmarble.cards")
	  } else if (mode == modeType.BURN) {
	  	// else if it was redeemed, go to opensea to make a bid
	  	status_tokens.push("https://opensea.io/assets/0x1d963688fe2209a98db35c67a041524822cf04ff/")	  	
	  	status_tokens.push(card_id)
	  	status_tokens.push("?ref=")
	  	status_tokens.push(OPEN_SEA_REFERRAL)
	  }
	  status_tokens.push("\n")

	  // lastly, the marble card link on the home site
	  status_tokens.push("🔗 ")
	  status_tokens.push("https://marble.cards/card/")
  	  status_tokens.push(card_id)
	  status_tokens.push(" #MarbleCards #NFT")

	  var status = status_tokens.join("")

	  console.log("Scheduling tweet: " + status)

	  var payload = {
	  	status : status
	  }		

	  schedule_task('/task/tweet', 5, payload);
	  
	  original_res.status(200).send('{}').end();
	}).catch((error) => {
	  console.error(error)
	  original_res.status(200).send('{}').end();
	})
});

app.get('/task/tweet', (req, res) => {
	var tweet_status = parseInt(req.body.status)

	if (tweet_status !== undefined) {
		console.log(tweet_status)
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
	refresh_internal(modeType.BURN, res)
});

app.get('/task/refresh/deposits', (req, res) => {
	refresh_internal(modeType.DEPOSIT, res)	
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;