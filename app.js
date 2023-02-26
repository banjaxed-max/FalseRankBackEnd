// This is the backend for the True Rank App. 
// This contains the logic and API's for the front end portion of the app 

// initializing dependencies
const { query } = require('express');
const express = require('express')
const app = express()
const https = require('https');
const url = require('url');
const querystring = require('querystring');

app.use(express.json());

// initializing backend app
app.listen(3000, (req, res) =>{
    console.log('True Rank API is running on port 3000');
})

// here, I initialize all of our app's API info like endpoints, api key's and the suffix for the api call
const getNASummonerBySummonerNameAPI = 'https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-name/';
const getMatchesBySummonerPuuIdAPI = 'https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/';
const getMatchByMatchIdAPI = 'https://americas.api.riotgames.com/lol/match/v5/matches/';
const riotAPIKey = 'RGAPI-f25c582d-3b4a-403e-9c3f-a52c208856aa'
const riotAPISuffix = '?api_key=' + riotAPIKey

// array to store all point totals - which we will add together at the end
// the reason we need all these values is because the foreach loop will evaluate games one at a time and save the values to the array so we can iterate through it and calculate a new score for each game
// this also means we can see each game's score individually
var pointTotals = []; // totalGameScore appends it's value to this each time the loop is iterated
var totalGameScore = 0; // total summoner score of the game
var pointSum = 0 // sum of the points that we use to calculate the rank
var message = ''; // the message containing either their rank or a specified error message. this is what is sent back to the client


// GET request to send the user input from the front end to the backend so we can check to see if it's a real account and then perform our calculations
app.get('/getSummonerData', async (req, res) => {
    // here we are simply parsing through our request from the front end to find the summonerName input by the user
    var request = url.parse(req.url).query;
    var params = querystring.parse(request) 
    const summonerName = params.summonerName

    getSummonerBySummonerName(getNASummonerBySummonerNameAPI, summonerName, getMatchesBySummonerId)
    
    // this will wait 5 seconds before sending the response back and resetting all values
    // soon, this system will probably be deprecated for a more 'real-time' solution as the app becomes more feature-rich. for right now though, this system works
    setTimeout(() => { 
        totalGameScore = 0
        pointTotals = []
        pointSum = 0
        res.json({status: '200', message: message})
    }, 5000) 
})

// this function calls the Riot API and returns info about the summoner based off of their LoL summoner name, which we will use to call other API's to give us information. 
// it uses the endpoint + the summoner name + the api key suffix for authorization
function getSummonerBySummonerName(endpoint, summonerName, callback) {
    console.log(endpoint + summonerName + riotAPISuffix)
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
                message = 'no_summoner_found'
                console.log('no summoner found!!!')
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
            
            callback(err)
        });
    }

// Once the summoner's name is retrieved, this callback function is called, which sends an api to request the match history based off of the 'puuid'
function getMatchesBySummonerId(error, summonerData) {
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
                message = 'no_recent_matches_found'
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
// finds the user's playerId from the rest of the players in the game
function determineRank(matchInfo, playerId) {
    const players = matchInfo.metadata.participants
    const unparsedParticipantInfo = JSON.stringify(matchInfo.info.participants)
    const participantInfo = JSON.parse(unparsedParticipantInfo)

    const performanceByPlayerId = participantInfo.find(obj => obj.puuid == playerId) // using game to find every json object that contains our puuid

    var deaths = participantInfo.deaths
    var kills = participantInfo.kills
    // var role = game.role
    // var vision = game.visionScore
    
    const gameData = [];

    players.forEach(player => {
        if (playerId == player) {
            
            gameData.push(performanceByPlayerId)
            for (let game in gameData) {
                if (typeof game.kills === undefined) {
                    gameData.pop();
                }
            }
        }
    })
    
    gameData.forEach(game => {
        // ALGORITHM
        // kills is our first metric for grading
        
        if (kills >= 35) {
            totalGameScore = totalGameScore + 20;
        } else if (kills < 35 && kills >= 30) {
            totalGameScore = totalGameScore + 18
        } else if (kills < 30 && kills >= 25) {
            totalGameScore = totalGameScore + 16
        } else if (kills < 25 && kills >= 20) {
            totalGameScore = totalGameScore + 14
        } else if (kills < 20 && kills >= 15) {
            totalGameScore = totalGameScore + 12
        } else if (kills < 15 && kills >= 10) {
            totalGameScore = totalGameScore + 6
        } else if (kills < 10 && kills >= 5) {
            totalGameScore = totalGameScore + 3
        } else if (kills < 5 && kills >= 1) {
            totalGameScore = totalGameScore - 3
        } else if (kills == 0) {
            totalGameScore = totalGameScore - 6
        }
        
        // deaths will be our next metric
        

        if (deaths >= 5) {
            totalGameScore = totalGameScore - 10;
        } else if (deaths == 4) {
            totalGameScore = totalGameScore - 8
        } else if (deaths == 3) {
            totalGameScore = totalGameScore - 6
        } else if (deaths == 2) {
            totalGameScore = totalGameScore - 4
        } else if (deaths == 1) {
            totalGameScore = totalGameScore - 2
        } else if (deaths == 0) {
            totalGameScore = totalGameScore + 6
        }

        // vision score will be our next metric

        // if (vision > 40 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore + 20;
        // } else if (vision < 40 && vision >= 35 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore + 18
        // } else if (vision < 35 && vision >= 30 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore + 16
        // } else if (vision < 30 && vision >= 25 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore + 14
        // } else if (vision < 25 && vision >= 20 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore + 12
        // } else if (vision < 20 && vision >= 15 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore + 10
        // } else if (vision < 15 && vision >= 10 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore + 5
        // } else if (vision < 10 && vision > 0 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore + 1
        // } else if (vision == 0 && role != 'SUPPORT') {
        //     totalGameScore = totalGameScore - 2
        // } 
        
        calculateTotals()
        console.log('total game score - ',totalGameScore)
        pointTotals.push(totalGameScore)
        }
    
    )
}


function calculateTotals() {
    pointSum = 0;

    for (let i = 0; i < pointTotals.length; i++) {
        pointSum += pointTotals[i];
    }
    console.log('total', pointSum)

    
    
    if (pointSum <= 50 && pointSum <= 0) {
        message = 'Bronze 4'
    } else if (pointSum <= 100 && pointSum > 50) {
        message = 'Bronze 3'
    } else if (pointSum <= 150 && pointSum > 100) {
        message = 'Bronze 2'
    } else if (pointSum <= 200 && pointSum > 150) {
        message = 'Bronze 1'
    } else if (pointSum <= 250 && pointSum > 200) {
        message = 'Silver 4'
    } else if (pointSum <= 300 && pointSum > 250) {
        message = 'Silver 3'
    } else if (pointSum <= 350 && pointSum > 300) {
        message = 'Silver 2'
    } else if (pointSum <= 400 && pointSum > 350) {
        message = 'Silver 1'
    } else if (pointSum <= 450 && pointSum > 400) {
        message = 'Gold 4'
    } else if (pointSum <= 500 && pointSum > 450) {
        message = 'Gold 3'
    } else if (pointSum <= 550 && pointSum > 500) {
        message = 'Gold 2'
    } else if (pointSum <= 600 && pointSum > 550) {
        message = 'Gold 1'
    } else if (pointSum <= 650 && pointSum > 600) {
        message = 'Platinum 4'
    } else if (pointSum <= 700 && pointSum > 650) {
        message = 'Platinum 3'
    } else if (pointSum <= 800 && pointSum > 700) {
        message = 'Platinum 2'
    } else if (pointSum <= 850 && pointSum > 750) {
        message = 'Platinum 1'
    } else if (pointSum <= 900 && pointSum > 850) {
        message = 'Diamond 4'
    } else if (pointSum <= 950 && pointSum > 900) {
        message = 'Diamond 3'
    } else if (pointSum <= 1000 && pointSum > 950) {
        message = 'Diamond 2'
    } else if (pointSum <= 1050 && pointSum > 1000) {
        message = 'Diamond 1'
    } else if (pointSum <= 1100) {
        message = 'TBA'
    }
    
    console.log(message)
    return pointSum, message;
    
    }   
}
