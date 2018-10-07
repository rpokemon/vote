const fs = require('fs');
const debug = require('debug')('routes');

module.exports = (express) => {

    // GET /vote/somevotename
    express.get('/vote/:vote_name', (req, res) => {

        // Handle if survey doesn't exist
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`)) {
            var error = { };
            error.survey_name = "Error 404: Survey not found";
            error.survey_description = "The survey you have specified could not be found.";
            error.path = req.path;
            return res.status(404).render('pages/error', error);
        }

        // Load the survey config
        var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8'));
        survey.path = req.path;


        // TODO: If authenticated, get the questions
        /*if (req.session.auth)
        {
            survey.questions = [ ];
        }*/

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
        survey.path = req.path;

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
