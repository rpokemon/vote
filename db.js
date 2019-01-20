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
    await db.run(`INSERT INTO \`${survey.name}\` (\`username\`) VALUES (?)`, username);
}


// Sets a users response to a question
async function setReponse(survey, username, question, answer) {
    const db = await dbPromise;
    await db.run(`UPDATE \`${survey.name}\` SET \`q${question}\` = ? WHERE \`username\` = ?;`, answer.toString(), username);
}


// Sets a response to completed
async function setCompletedResponse(survey, username) {
    const db = await dbPromise;
    await db.run(`UPDATE \`${survey.name}\ SET \`completed\` = 1 WHERE \`username\` = ?;`, username)
}


// Gets a users responses
async function getResponses(survey, username) {
    const db = await dbPromise;
    return await db.get(`SELECT * FROM \`${survey.name}\` WHERE \`username\` == ?;`, username);
}


// Checks if the user has responded to a survey
async function hasResponded(survey, username) {
    return await getResponses(survey, username) != undefined;
}


// Gets all completed responses
async function getCompletedResponses(survey) {
    const db = await dbPromise;
    return await db.all(`SELECT * FROM \`${survey.name}\` WHERE \`completed\`;`);
}


module.exports = {

    // Stores a response in the database
    setResponse: async (survey, username, question, answer) => {
        var userHasResponded = await hasResponded(survey, username); 
        if (!userHasResponded)
            await createResponse(survey, username);
        await setReponse(survey, username, question, answer);
    },


    // Gets a users responses to a survey
    getResponses: async (survey, username) => {
        return await getResponses(survey, username);
    },


    // Checks if the user has responded to a survey
    hasResponded: async (survey, username) => {
        return await hasResponded(survey, username);
    },

    // Checks if the user has completed their response
    hasCompletedResponse: async (survey, username) => {
        if (!hasResponded(survey, username))
            return false;
        var response = await getResponses(survey, username);
        return false;
    },


    // Returns all completed responses to a survey
    getCompletedResponses: async (survey) => {
        var responses = [];
        (await getCompletedResponses(survey)).forEach((result) => {
            delete result.username;
            delete result.completed;
            responses.push(result);
        });
        return responses;
    },


    // Sets a users response to completed
    setCompletedResponse: async (survey, username) => {
        await setCompletedResponse(survey, username);
    }
}

