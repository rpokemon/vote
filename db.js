const fs = require('fs');
const path = require('path');
const sqlite = require('sqlite');

const dbPromise = sqlite.open(`${__dirname}/responses.db`, { Promise });


// Function sorts response items
function sortResponses(responses) {
    var sorted = new Array(Object.keys(responses).length);
    for (var index in responses) {
        sorted[index.match(/\d+/)[0]] = responses[index];
    }
    return sorted;
}


// Function creats a new database table if one does not exist
async function createTable(survey) {
    // Get the database
    const db = await dbPromise;

    // add questions
    var questions = new String();
    for (index in survey.questions) {
        var question = survey.questions[index];
        questions = questions.concat(`\`question_${index}\` BLOB ${question.required ? 'NOT NULL' : ''},\n`);
    }

    // Create the table
    await db.run(`CREATE TABLE IF NOT EXISTS \`${survey.name}\` (
        \`username\` TEXT NOT NULL UNIQUE,
        ${questions}
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


module.exports = {

    // Stores a response in the database
    setResponse: async (survey, username, responses) => {
        const db = await dbPromise;
        responses = sortResponses(responses);
        await db.run(`INSERT INTO \`${survey.name}\` VALUES (?, ${responses.map(_ => '?').join(', ')});`, [username, ...responses]);
    },


    // Checks if the user has already responded to a survey
    hasRespomded: async (survey, username) => {
        const db = await dbPromise;
        return await !typeof db.get(`SELECT * FROM \`${survey.name}\` WHERE \`username\` == ?;`, username) == 'undefined';
    },


    // Returns all responses to a survey
    getReponse: async (survey) => {
        const db = await dbPromise;
        return {};
    }
}
