const fs = require('fs');
const debug = require('debug')('routes');

module.exports = (express) => {

    // GET /vote/somevotename
    express.get('/vote/:vote_name', (req, res) => {
        if (req.params.vote_name === 'ui_test')
            return res.status(200).render('pages/vote', JSON.parse(fs.readFileSync(`${__dirname}/ui_test.json`, 'utf-8')));

        var survey = { };

        // TODO: Get survey name and description
        survey.survey_name = "some survey name";
        survey.survey_description = "some longform survey description";

        // TODO: If authenticated, get the questions
        if (req.session.auth)
        {
            survey.questions = [ ];
        }

        // TODO: Handle survey doesn't exist

        res.status(200).render('pages/vote', survey);
    });
    
    // POST /vote/somevotename/response
    express.post('/vote/:vote_name/response', (req, res) => {

        // ignore any response where the user hasn't otherwise authenticated
        if (!req.session.auth)
            return res.status(500);
        
        // req.body will be an array
        var response = req.body;

        // TBD: response format

        // TODO: store results for vote from response

        res.status(200);
    });

    // GET /vote/somevotename/results
    express.get('/vote/:vote_name/results', (req, res) => {

        var survey = { };

        // TODO: determine if authentication is required (e.g. for mod vote)

        // TODO: get results object for vote
        survey.survey_name = "some survey name";
        survey.survey_description = "some longform survey description";

        // TBD: results object format
        res.status(200).render('pages/results', survey);
    });

    // POST /vote/auth/someredditusername
    express.post('/vote/auth/:username', (req, res) => {

        // TODO: authenticate users
        req.session.auth = true;
        
        res.status(req.session.auth ? 200 : 500);
    })
};
