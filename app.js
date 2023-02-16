// This is the backend for the True Rank App. 
// This contains the logic and API's for the front end portion of the app 

// initializing dependencies
const express = require('express')
const app = express()
const https = require('https');

app.use(express.json());

// initializing backend app
app.listen(3000, (req, res) =>{
    console.log('True Rank API is running on port 3000');
})

// here, I initialize all of our app's API info like endpoints, api key's and the suffix for the api call
const getNASummonerBySummonerNameAPI = 'https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/';
const getMatchesBySummonerPuuIdAPI = 'https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/';
const getMatchByMatchIdAPI = 'https://americas.api.riotgames.com/lol/match/v5/matches/';
const riotAPIKey = 'RGAPI-01691bc2-d43b-4846-ab82-5058fd1a4b4b'
const riotAPISuffix = '?api_key=' + riotAPIKey

// array to store all point totals - which we will add together at the end
const pointTotals = [];
var totalRankScore = 0;

var pointSum = 0;

// GET request to get summoner data back (after it has run through ranking logic) to the front end app 
// This currently serves no purpose. Soon I will add functionality so it can be called in the front end
// app.get('/getSummonerData', (req, res) => {
//     res.json({
//         "statusCode":200,
//         "statusMessage": "SUCCESS"
//     })
// })

// POST request to send the user input from the front end to the backend so we can check to see if it's a real account
app.post('/sendSummonerName', async (req, res) => {
    const summonerName = req.body;
    const unparsedData = JSON.stringify(summonerName)
    const userSummoner = JSON.parse(unparsedData)
    getSummonerBySummonerName(getNASummonerBySummonerNameAPI, userSummoner.summonerName, getMatchesBySummonerId)
    res.json({ status_code: '200', rank: pointSum})
    
})



// this function calls the Riot API and returns info about the summoner based off of their LoL summoner name, which we will use to call other API's to give us information. 
// it uses the endpoint + the summoner name + the api key suffix for authorization
function getSummonerBySummonerName(endpoint, summonerName, callback) {
    https.get(endpoint + summonerName + riotAPISuffix, (res) => {
        let summonerData = '';
        
        res.on('data', (chunk) => {
            summonerData += chunk;
        });

        res.on('end', () => {
            const parsedSummoner = JSON.parse(summonerData)
            const summonerId = parsedSummoner.id
            const summonerAccountId = parsedSummoner.accountId
            const summonerPuuID = parsedSummoner.puuid

            if (summonerId == undefined) {
                console.log('no summoner found!!!')
                // should throw err
            } else {
                const summonerData = {
                    id: summonerId,
                    accountId: summonerAccountId,
                    puuid: summonerPuuID
                }
                callback(null, summonerData)
            }

        });

        }).on('error', (err) => {
            console.log('Uncaught Error has occured: ' + err.message);
            
            callback(err) // debating taking this out and rather just calling an error function directly
        });
        
            
    }

    // Once the summoner's name is retrieved, this callback function is called, which sends an api to request the match history based off of the 'puuid'
    function getMatchesBySummonerId(error, summonerData, callback) {
        if (error) {
            console.log('Error occurred:', error);
        } else {
            let matchAPISuffix = '/ids?start=0&count=10&api_key=' + riotAPIKey  // This specific api needs a special suffix, since we are specifying how many matches we want in the call
            https.get(getMatchesBySummonerPuuIdAPI + summonerData.puuid + matchAPISuffix, (res) => {
                let allMatchesData = '';
        
            res.on('data', (chunk) => {
                allMatchesData += chunk;
            });

            res.on('end', () => {
                const parsedMatches = JSON.parse(allMatchesData)

                if (allMatchesData == undefined || null) {
                    console.log('no matches found!!!')
                    // throw err
                } else {
                    parsedMatches.forEach(matchId => {
                        getMatchInfoByMatchId(getMatchByMatchIdAPI, matchId, summonerData.puuid)
                    }); 
                }
                
            });

            }).on('error', (err) => {
                console.log('Uncaught Error has occured: ' + err.message);
                callback(err)
            });
        }

    
    // This function will send an API request to get the match info by the match id which we got from the "sendSummonerName" function
    function getMatchInfoByMatchId(endpoint, matchId, playerId) {
        https.get(endpoint + matchId + riotAPISuffix, (res) => {
            let matchInfo = '';
        
        res.on('data', (chunk) => {
            matchInfo += chunk;
        });

        res.on('end', () => {
            matchInfo = JSON.parse(matchInfo)
            determineRank(matchInfo, playerId)
        });
        
    });

    }

    function determineRank(matchInfo, playerId) {
        const players = matchInfo.metadata.participants
        const unparsedParticipantInfo = JSON.stringify(matchInfo.info.participants)
        const participantInfo = JSON.parse(unparsedParticipantInfo)

        players.forEach(player => {
            if (playerId == player) {
                
                console.log('found - ', playerId)
                
                if (player == playerId) {
                    const playerObj = participantInfo.find(playerObj => playerObj.puuid == playerId) // using playerObj to find every json object that contains our puuid
                    

                    // takedowns is our first metric for grading
                    const takedowns = playerObj.challenges.takedowns
                    console.log(playerObj)
                    console.log(playerObj.summonerName, ' has ', takedowns, ' takedowns. ')
                
                    if (takedowns >= 35) {
                        totalRankScore = totalRankScore + 9;
                    } else if (takedowns < 35 && takedowns >= 30) {
                        totalRankScore = totalRankScore + 7
                    } else if (takedowns < 30 && takedowns >= 25) {
                        totalRankScore = totalRankScore + 6
                    } else if (takedowns < 25 && takedowns >= 20) {
                        totalRankScore = totalRankScore + 5
                    } else if (takedowns < 20 && takedowns >= 15) {
                        totalRankScore = totalRankScore + 4
                    } else if (takedowns < 15 && takedowns >= 10) {
                        totalRankScore = totalRankScore + 3
                    } else if (takedowns < 10 && takedowns >= 5) {
                        totalRankScore = totalRankScore + 2
                    } else if (takedowns < 5 && takedowns >= 1) {
                        totalRankScore = totalRankScore + 1
                    } else if (takedowns == 0) {
                        totalRankScore = totalRankScore + 0
                    }
    
                    
                    pointTotals.push(totalRankScore)
                    
                }
            }
        });
        calculateTotals()
    }
    
    function calculateTotals() {
        pointSum = 0;

        for (let i = 0; i < pointTotals.length; i++) {
            pointSum += pointTotals[i];
        }

        console.log('total points - ', pointSum);
        
    }
}


