require ('dotenv').config();
const tmi = require('tmi.js');
const https = require('https');
const {Pool} = require('pg')
const WebSocket = require('ws')
const socket = new WebSocket(process.env.SOCKET)

const pool = new Pool(
    {
        user: process.env.USER,
        host: process.env.HOST,
        database: process.env.DATABASE,
        password: process.env.PASSWORD,
        port: 5432

    }
)



pool.connect()

//show words in DB with specific max points and number of words per length
const wordsPointsShapesDB = 'SELECT * FROM words WHERE points = $1 AND five = $2 AND six = $3 AND seven = $4 AND eight = $5'

//show words in DB with specific max points
const wordsWordsDB = 'SELECT * FROM words WHERE words = $1'

//insert words in DB
const insertWord = 'INSERT INTO words(words, points, five, six, seven, eight) VALUES ($1, $2, $3, $4, $5, $6)'


// Define configuration options
const opts = {options: { debug: true },
    connection: {
        secure: true,
        reconnect: true
    },
    identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.OAUTH_TOKEN
    },
    channels: [
        process.env.CHANNEL_NAME
    ]
};

// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();


let biggie;
let level = 0;
let points = 0;
let five = 0, six = 0, seven = 0, eight = 0;

socket.onopen = async(event) =>{
    console.log(`Connected to Words on Stream`)
    socket.send(`42[1,"`+ process.env.MIRROR +`", null, null, null, 2]`)
    socket.send(2)
}


// send data every 25 seconds
setInterval(
    async () =>{
        socket.send(2)
    }, 25000
)


function bigWord(word)
{
    //space and capitalize letters
    return word.split('').join(' ').toUpperCase().trim();
}

// Called every time a message comes in
async function onMessageHandler (target, context, msg, self) {
    if (self) {
        return;
    } // Ignore messages from the bot

    // Remove whitespace from chat message
    const commandName = msg.trim();

    const args = commandName.slice(1).split(' ');
    args.shift().toLowerCase();
    args.toString().trim();
    socket.onmessage = async function (event) {

        if (event.data[5] === `1` && event.data[6] === `,`) {
            let info = JSON.parse(event.data.substring(event.data.indexOf('{'), event.data.lastIndexOf('}') + 1))
            level = info.level
            points = parseInt(info.maxPoints)
            //show level info
            console.debug('Level ' + level + ' about to begin!')
            //get number of maximum points
            console.debug(points)

            //the number of words of each length
            for (let slot = 0; slot < info.slots.length; slot++) {
                switch (info.slots[slot].letters.length) {
                    case 5:
                        five++
                        break

                    case 6:
                        six++
                        break

                    case 7:
                        seven++
                        break

                    case 8:
                        eight++
                        break
                }
            }

            console.log("5-letters: " + five)
            console.log("6-letters: " + six)
            console.log("7-letters: " + seven)
            console.log("8-letters: " + eight)

            //check if word exists in DB
            pool.query(wordsPointsShapesDB, [points, five, six, seven, eight], (err, res) => {

                    //if it exists
                    if (res.rows.length > 0) {
                        for (let j = 0; j < res.rows.length; j++) {
                            //show the corresponding words
                            console.debug(bigWord(res.rows[j].words))
                        }


                    }


                }
            )


        }

        //if the big word is found
        if (event.data[5] === `3`) {
            let info = JSON.parse(event.data.substring(event.data.indexOf('{'), event.data.lastIndexOf('}') + 1))
            if (info.hitMax) {
                //find the user who typed the big word in Twitch chat
                if (info.user.name === `${context['display-name']}`.toLowerCase()) {


                    console.log(msg)

                    //check if word exists in DB
                    pool.query(wordsPointsShapesDB, [points, five, six, seven, eight], (err, res) => {

                            //if it doesn't exist
                            if (res.rows.length === 0) {
                                //add it to the DB
                                pool.query(insertWord, [points, five, six, seven, eight])
                                console.debug(insertWord + " added to the list of words")
                            }


                        }
                    )


                }

            }


        }


        //when level ends
        if (event.data[5] === `5` || event.data[5] === `4`) {
            console.debug('Level ' + level + ' completed!')
            //reset big word
            biggie = undefined
            five = 0, six = 0, seven = 0, eight = 0;
        }


    }


}





// Called every time the bot connects to Twitch chat
async function onConnectedHandler (addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
}
