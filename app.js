const express = require('express')
const app = express()
const https = require('https');

app.use(express.json());

const getNASummonerBySummonerNameAPI = 'https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/';
const riotAPIKey = 'RGAPI-32ae2f76-5db7-4596-a14f-29c18d1dd242'
const riotAPISuffix = '?api_key=' + riotAPIKey

var summonerNameNotFound = false;


// API request to get summoner data (after it has run through ranking logic) to the front end app
app.get('/getSummonerData', (req, res) => {
    if (summonerNameNotFound == true) {
        res.json({
            "statusCode": 404,
            "statusMessage": FAILED,
            "message": "This summoner was not found."
        })
    } else {
        res.json({
            "statusCode":200,
            "statusMessage": "SUCCESS"
        })
    }
    
})


// API request to send the user input to the backend
app.post('/sendSummonerName', (req, res) => {
    const summonerName = req.body;
    const unparsedData = JSON.stringify(summonerName)
    const userSummoner = JSON.parse(unparsedData)
    console.log('Someone has inputted a summoner name! The name is - ', userSummoner.summonerName)
    getSummonerBySummonerName(getNASummonerBySummonerNameAPI, userSummoner.summonerName)
})

// initializing backend app
app.listen(3000, (req, res) =>{
    console.log('Express API is running on port 3000');
})

// riot api key
// RGAPI-32ae2f76-5db7-4596-a14f-29c18d1dd242

// this function calls the Riot API and returns info about the summoner based off of their LoL summoner name, which we will use to call other API's to give us information. 
// it uses the endpoint + the summoner name + the api key suffix for authorization
function getSummonerBySummonerName(endpoint, summonerName) {
    console.log(endpoint + summonerName + riotAPISuffix)
    https.get(endpoint + summonerName + riotAPISuffix, (res) => {
        let summonerData = '';

        console.log(res.status_code)
        if (res.status_code = 404) {
            return summonerNameNotFound = true;
        }
        
        res.on('data', (chunk) => {
            summonerData += chunk;
        });

        res.on('end', () => {
            console.log(JSON.parse(summonerData));
        });

        }).on('error', (err) => {
        console.log('Error: ' + err.message);
        });
    
    
    }
