const fs = require('fs');
const debug = require('debug')('routes');

const db = require('./db.js');
const auth = require('./auth.js');

const authentication_enabled = !process.env.hasOwnProperty("disable_auth");

// Function generates an error page given error type, name and description
function genError(req, res, type, name, description) {
    var error = {
        survey_name: `Error ${type}: ${name}`,
        survey_description: description,
        path: req.path,
        auth: req.session.auth
    };
    return res.status(type).render('pages/error', error);
}


// Function redirects to the last survey visited or root page
function redirect(req, res) {
    if (req.session.survey_name)
        return res.redirect(`/vote/${req.session.survey_name}`);
    else
        return res.redirect('/');
}


// Function validates a response to a question
function validate_response(question, response) {
    switch (question.response_type) {

        case 'bool':
            if (!question.response_scale.includes(response))
                return false;
            break;

        case 'multi':
            if (Array.isArray(response)) {
                response.forEach(element => {
                    if (!question.response_scale.includes(element))
                        return false;
                });
            }
            else if (!question.response_scale.includes(response))
                return false;

            break;

        case 'int':
            if (response < question.response_scale[0] || response > question.response_scale[1])
                return false;
            break;

        case 'text':
            var min_size = question.response_scale[0].slice(0, question.response_scale[0].length - 1);
            switch (question.response_scale[0][question.response_scale[0].length - 1]) {
                case 'w':
                    if (response.split(' ').length < min_size)
                        return false;
                    break;
                case 'c':
                    if (response.length < min_size)
                        return false;
                    break;
            }

            var max_size = question.response_scale[1].slice(0, question.response_scale[1].length - 1);
            switch (question.response_scale[1][question.response_scale[1].length - 1]) {
                case 'w':
                    if (response.split(' ').length > max_size)
                        return false;
                    break;
                case 'c':
                    if (response.length > max_size)
                        return false;
                    break;
            }
            break;
    }

    return true;
}

module.exports = (express) => {

    // GET /
    express.get('/vote', (req, res) => {
        var data = {
            survey_name: 'Home',
            survey_description: '/r/Pokemon survey platform.',
            path: '/vote',
            auth_state: req.session.state,
            auth: req.session.auth
        }
        return res.status(200).render('pages/index', data);
    });


    // GET /vote/auth/someauthtype
    express.get('/vote/auth/:auth_type', async (req, res) => {

        // Check auth type is valid
        var auth_type = auth[req.params.auth_type];
        if (!auth_type)
            return genError(req, res, 500, 'Internal Server Error', 'An error has occured: Invalid auth type specified. Please try again. ');

        // Check auth is valid
        if (!auth_type.validate(req, res))
            return genError(req, res, 500, 'Internal Server Error', 'An error has occured: Auth invalid. Please try again.');

        // Authorize
        req.session.auth = await auth_type.authorize(req, res);

        // Redirect to last survey
        return redirect(req, res);
    });


    // GET /vote/deauth
    express.get('/vote/deauth', (req, res) => {

        // Remove session information
        delete req.session.auth;

        // Redirect to last survey
        return redirect(req, res);

    });


    // GET /vote/somevotename
    express.get('/vote/:vote_name', (req, res) => {

        // Set most recent survey name
        req.session.survey_name = req.params.vote_name;

        // Handle if survey doesn't exist
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`))
            return genError(req, res, 404, 'Survey not found', 'The survey you have specified could not be found.');

        // Load the survey config
        var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8'));
        survey.path = req.path;

        if (authentication_enabled) {
            // Handle if the user is not logged in
            if (!req.session.auth || req.session.auth.type != survey.auth_type) {

                survey.questions = null;
                survey.require_auth = true;
                survey.auth_url = auth[survey.auth_type].generate_url(req, res)

                return res.status(200).render('pages/vote', survey);
            }

            // Handle if user is not authorised
            if (!req.session.auth.is_mod && survey.requires_mod)
                return genError(req, res, 401, 'Unauthorized', 'You are not authorized to access this survey.');

            // TODO: Handle if the user has already voted - DO WE NEED THIS?
            //if (!true) {
            //    return genError(req, res, 403, 'Access Denied', 'You have already voted on this survey.');
            //}

            survey.auth = req.session.auth;
        }

        res.status(200).render('pages/vote', survey);
    });


    // POST /vote/somevotename/response
    express.post('/vote/:vote_name/response', async (req, res) => {

        // 400 BAD REQUEST: Survey does not exist
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`))
            return res.status(400).end();

        // Get the survey
        var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8'));
        survey.name = req.params.vote_name;

        // 401 UNAUTHORIZED: User hasn't gone through account verification
        if (authentication_enabled && !req.session.auth)
            return res.status(401).end();

        // req.body has two properties, q and a
        // q is the question number, zero indexed
        // a is the given response, which should be checked for consistency with the expected ranges
        var q = req.body.q;
        var a = req.body.a;

        // 400 BAD REQUEST: Malformed or non-existent response, probably a UI-bug
        if (q == null | a == null)
            return res.status(400).end();

        // 409 CONFLICT: Response isn't what we expect, indicating tomfoolery.
        if (q < 0 || q >= survey.questions.length)
            return res.status(409).end();

        if (!validate_response(survey.questions[q], a))
            return res.status(409).end();

        // Store results for vote from response
        await db.setResponse(survey, req.session.auth.username, q, a);
        res.status(200).end();
    });

    express.post('/vote/:vote_name/complete', async (req, res) => {

        // 400 BAD REQUEST: Survey does not exist
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`))
            return res.status(400).end();

        // Get the survey
        var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8'));
        survey.name = req.params.vote_name;

        // 401 UNAUTHORIZED: User hasn't gone through account verification
        if (authentication_enabled && !req.session.auth)
            return res.status(401).end();

        // 409 CONFLICT: User has alreay completed the survey
        if (await db.hasCompletedResponse(survey, req.session.auth.username))
            return res.status(409).end();

        // 409 CONFLICT: User has not completed all required questions
        responses = await db.getResponses(survey, req.session.auth.username)
        survey.questions.forEach(function (question, index) {
            if (question.required && responses[`q${index}`] == null)
                return res.status(409).end();
        });

        await db.setCompletedResponse(survey, req.session.auth.username);
        res.status(200).end();
    });


    // GET /vote/somevotename/results
    express.get('/vote/:vote_name/results', async (req, res) => {

        // Handle if survey doesn't exist
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`))
            return genError(req, res, 404, 'Survey not found', 'The survey you have specified could not be found.');

        // Load the survey config
        var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8'));
        survey.path = req.path;

        // TODO: determine if results are accessible (e.g. survey finished)
        if (false)
            return genError(req, res, 401, 'Unauthorized', 'You are not authorized to access this page.');

        // TODO: determine if authentication is required (e.g. for mod vote)
        if (false)
            return genError(req, res, 401, 'Unauthorized', 'You are not authorized to access this page.');

        // Get results array for vote
        survey.responses = await db.getCompletedResponses(req.params.vote_name);

        // survey.responses is an array of response onjects
        // response objects containing keys of format q{id}

        res.status(200).render('pages/results', survey);
    });


};
