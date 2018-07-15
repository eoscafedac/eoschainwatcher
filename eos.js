var Eos = require('eosjs') // Eos = require('./src')
var blockParse = require('./blockParse.js');

var MongoClient = require('mongodb').MongoClient;
var url = process.env.MONGODB_URI;

const chainLogging = false;
const runTimer = 350;

// EOS
EosApi = require('eosjs-api')
eosconfig = {
 httpEndpoint: "https://mainnet.eoscalgary.io"
}

eos = EosApi(eosconfig)

// Getting starting block id
//var idx = 0;
var previousReadBlock = -1;

//set initial block
function getLatestBlock(){
 eos.getInfo({}).then(result => {
  startIndex = result.head_block_num;

  if(chainLogging == true)
   console.log("getinfo block", previousReadBlock);
  if(previousReadBlock <  startIndex){
   //idx = startIndex;
   //read block
    console.log("Memory heap usage ", process.memoryUsage().heapTotal/(1024*1024));
 	console.log("Memory rss usage ", process.memoryUsage().rss/(1024*1024));
   console.log("callong saveBlockInfo for block number", startIndex);
   saveBlockInfo(startIndex);
  }else{
   setTimeout(getLatestBlock, runTimer);
   if(chainLogging == true)
    console.log("Do nothing", "previousReadBlock", "startIndex", "idx",previousReadBlock,startIndex) ;//do nothing
  }
 });
}


function saveData(block, account, data, type){ 
  //var fData = formatData(data, type);
  //botClient.sendAlarm(account, fData);
 /* Temporary disable saving data to MongoDB due to the size limit
 after find one and if available then save */
	console.log("calling saveData for account");
	MongoClient.connect(url, function(err, db) {
		var dbo = db.db("heroku_dtfpf2m1");
		var findquery = {eosid : account};
		dbo.collection("customers").findOne(findquery, function(err, result){
			if(result == null){
				console.log("there is no matched one ", account);
				db.close();
			}else{
				//insert data
				var fData = formatData(data, type);
				var myobj = { block : block, account : account, data : fData, report : false };
				dbo.collection("alarm").insertOne(myobj, function(err, res){
					if (err) throw err;
					console.log("one document inserted to alarm db ", account);
					db.close();
				});
			}
		});
	}); 
}
 
function checkAccount(result){
   //idx++;
 if(result.transactions.length == 0){
 	return;
 }else{
 	if(chainLogging == true)
  		console.log("transaction length ", result.transactions.length);
  	for(i = 0;i<result.transactions.length;i++){
  	//check transaction type
  		var trx = result.transactions[i].trx.transaction;
  		if(trx == undefined)
   			continue;
   		for(j=0;j<trx.actions.length;j++){
    			if(chainLogging == true)
    				console.log("action length", trx.actions.length);
    			if(trx.actions[j] ==  undefined && trx.actions[j].length != 0)
     				continue;
    
  			var type = trx.actions[j].name;
  			var data = trx.actions[j].data; 
      //filtering malicious event
      if(type == "ddos" || type == "tweet")
       continue;
  			var account = null;
  			if(type == "transfer" || type == "issue" ){
  				account = data.to;
  			}else if(type == "newaccount"){
  				account = data.creator;
  			}else if(type == "voteproducer"){
  				account = data.voter;  
  			}else if(type == "undelegatebw" || type == "delegatebw"){
  				account = data.from;
  			}else if(type == "ddos"){
  				account = trx.actions[0].account;
  			}else if(type == "bidname"){
  				account = data.bidder;
  			}else if(type == "awakepet" || type == "feedpet" || type == "createpet"){
  				account = trx.actions[j].authorization[0].actor;
  			}else if(type == "refund"){
  				account = data.owner;
  			}else if(type == "buyram"){
  				account = data.payer;
  			}else if(type == "sellram" || type == "updateauth"){
  				account = data.account;
  			}else{
   				;
      
      account = blockParse.getAccountInfo(data);
      
  			}//end of else
  
  			if(account != null && type != "ddos" && type != "tweet"){     
   				//console.log("calling sendalarm in eosjs", account);
   				saveData(result.block_num, account, data, type);
   				account = null;
 			  }//end of if
   		}//end of for, actions
 	}//end of for of transaction
 }//end of else 
}//end of function


 
function saveBlockInfo(idx){
 //console.log("saveBlockInfo for ",idx);
 eos.getBlock(idx).then(result => {
  retryCount = 0;
  if(chainLogging == true)
   console.log("read block suceess for block number", idx);
  checkAccount(result);
  //saving the latest success block number.
  previousReadBlock = idx;
  idx++;
  setTimeout(getLatestBlock, runTimer);
  })
 .catch((err) => {

  if(chainLogging == true)
   console.log("getblockfailed");

  console.log(err);
  setTimeout(getLatestBlock, runTimer);
 }); // end of getblock
} //end of function

function formatData(data, type){
  if(type == "transfer"){
   msg = "Transfer Event";
   msg += "\n";
   msg += "To : " + data.to;
   msg += "\n";
   msg += "From : " + data.from;
   msg += "\n";
   msg += "Transfer Amount : " + data.quantity;
   msg += "\n";
   msg += "Memo : " + data.memo
  }else if(type == "newaccount"){
   msg = "New Account Event";
   msg += "\n";
   msg += "Created Account : " + data.name;
  }else if(type == "voteproducer"){
   msg = "Voting Event";
   msg += "\n";
   msg += "Voted to"
   msg += "\n";
   for(i = 0;i < data.producers.length;i++){
    msg += data.producers[i] + ", ";
   }
  }else if(type == "undelegatebw"){
   msg = "EOS Unstake Event";
   msg += "\n";
   msg += "Unstaked for Network : " + data.unstake_net_quantity
   msg += "\n";
   msg += "Unstaked for CPU : " + data.unstake_cpu_quantity
   
  }else if(type == "delegatebw"){
   msg = "EOS Staking Event";
   msg += "\n";
   msg += "Staked for Network : " + data.stake_net_quantity
   msg += "\n";
   msg += "Staked for CPU : " + data.stake_cpu_quantity
  }else if(type == "issue"){
   msg = "Issue Event";
   msg += "\n";
   msg += "Quantity" + data.quantity;
   msg += "Memo : " + data.memo
  }else if(type == "bidname"){
   msg = "Account Bidding Event";
   msg += "\n";
   msg += "Account : " + data.newname   
   msg += "\n";
   msg += "Bidding Amount : " + data.bid
  }else if(type == "awakepet"){
   msg = "You waken PET";
  }else if(type == "createpet"){
   msg = "You created PET ";
   msg += data.pet_name;   
  }else if(type == "refund"){
   msg = "Refund Event";
  }else if(type == "updateauth"){
   msg = "Your Authority Updated";
   msg += "\n";
   msg += "Public Key " + data.auth.keys[0].key;
  }else if(type == "sellram"){
   msg = "You sell RAM";
   msg += "\n";
   msg += "Amount " + data.bytes;
  }else if(type == "buyram"){
   msg = "You buy RAM";
   msg += "\n";
   msg += "Amount " + data.quant + " to " + data.receiver;
  }else{
   //console.log("need to be implemented");
   msg = "This event will be supported in near future";
   msg += "\n";
   msg += "Event type : " + type;
   msg += "\n";
   //json object to stringfy
   var buf = Buffer.from(JSON.stringify(data));
   msg += buf;
  }
 
 return msg;
 
}
                        
 setTimeout(getLatestBlock, runTimer);


