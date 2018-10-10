const fs = require('fs');
const path = require('path');
const sqlite = require('sqlite');

const dbPromise = sqlite.open(`${__dirname}/responses.db`, { Promise });


// Function creats a new database table if one does not exist
async function createTable(survey) {
    // Get the database
    const db = await dbPromise;

    // add questions
    var questions = new String();
    for (index in survey.questions) {
        var question = survey.questions[index];
        questions = questions.concat(`\`q${index}\` BLOB,\n`);
    }

    // Create the table
    await db.run(`CREATE TABLE IF NOT EXISTS \`${survey.name}\` (
        \`username\` TEXT NOT NULL UNIQUE,
        ${questions}
        \`completed\` INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(\`username\`)
    );`);
}


// Setup response tables if they don't exist
fs.readdirSync(`${__dirname}/surveys`).forEach(async file => {

    // Get Survey information
    var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${file}`, 'utf-8'));
    survey.name = path.parse(file).name;

    // Create the table
    await createTable(survey);
});


// Creates an entry in the database
async function createResponse(survey, username) {
    const db = await dbPromise;
    await db.run(`INSERT INTO \`${survey}\` (\`username\`) VALUES (?)`, username);
}


// Sets a users response to a question
async function setReponse(survey, username, response) {
    const db = await dbPromise;
    await db.run(`UPDATE \`${survey}\` SET \`${response.question}\` = ? WHERE \`username\` = ?;`, response.answer, username);
}


// Gets a users responses
async function getResponses(survey, username) {
    const db = await dbPromise;
    return await db.get(`SELECT * FROM \`${survey}\` WHERE \`username\` == ?;`, username);
}


// Gets all completed responses
async function getCompletedResponses(survey) {
    const db = await dbPromise;
    return await db.all(`SELECT * FROM \`${survey}\` WHERE \`completed\`;`);
}


module.exports = {

    // Stores a response in the database
    setResponse: async (survey, username, response) => {
        if (!hasResponded(survey, username))
            await createResponse(survey, username);
        await setReponse(survey, username, response);
    },


    // Gets a users responses to a survey
    getResponses: async (survey, username) => {
        return await getResponses(survey, username);
    },


    // Checks if the user has already responded to a survey
    hasResponded: async (survey, username) => {
        return await !typeof getReponses(survey, username) == 'undefined';
    },

    
    // Returns all completed responses to a survey
    getCompletedResponses: async (survey) => {
        const db = await dbPromise;
        var responses = [];
        (await getCompletedResponses(survey)).forEach((result) => {
            delete result.username;
            delete result.completed;
            responses.push(result);
        });
        return responses;
    }
}

