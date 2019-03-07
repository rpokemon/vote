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

// Function checks if a survey has expired
function has_expired(survey) {
    if (survey.hasOwnProperty('expires')) {
        var now = new Date();
        var expiry_date = new Date(survey.expires);

        return expiry_date < now;
    }
    return false;
}


// Function validates a response to a question
function validate_response(question, response) {
    switch (question.response_type) {

        case 'bool':
            if (response < 0 || response >= question.response_scale.length)
                return false;
            break;

        case 'multi':
            if (Array.isArray(response)) {
                if (response.length < question.required) {
                    return false;
                }
                response.forEach(element => {
                    if (element < 0 || element >= question.response_scale.length)
                        return false;
                });
            }
            else {
                if (question.required > 1) {
                    return false;
                }

                if (response < 0 || response >= question.response_scale.length)
                    return false;
            }

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

        case 'rank':
            if (response.length != question.response_scale.length)
                return false;
            for (var i = 0; i < response.length; i++) {
                if (isNaN(response[i]) && response[i] <= 0 || response[i] > response.length)
                    return false;
            };
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

    // GET /vote/sample/:question_type
    express.get('/vote/sample/:question_type', async (req, res) => {

        // Check question type is valid
        if (!fs.existsSync(`${__dirname}/samples/${req.params.question_type}.json`))
            return genError(req, res, 404, 'Sample not found', 'The sample you have specified could not be found.');

        question = {
            vote: JSON.parse(fs.readFileSync(`${__dirname}/samples/${req.params.question_type}.json`)),
            key: '_0'
        }

        res.status(200).render('pages/sample', question);
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

        // Handle if the survey has expired
        if (has_expired(survey))
            return genError(req, res, 403, 'Forbidden', 'This survey has already expired.');


        if (authentication_enabled) {
            // Handle if the user is not logged in
            if (!req.session.auth || survey.auth_types.indexOf(req.session.auth.type) == -1) {

                survey.questions = null;
                survey.auth_urls = [];
                survey.auth_types.forEach(function (auth_type) {
                    survey.auth_urls.push(auth[auth_type].generate_url(req, res));
                });

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

        // Handle if the survey has expired
        if (has_expired(survey))
            return res.status(403).end();

        // req.body has two properties, q and a
        // q is the question number, zero indexed
        // a is the given response, which should be checked for consistency with the expected ranges
        var q = req.body.q;
        var a = req.body.a;

        // 400 BAD REQUEST: Malformed or non-existent response, probably a UI-bug
        if (q == null)
            return res.status(400).end();

        // 409 CONFLICT: User has alreay completed the survey
        if (await db.hasCompletedResponse(survey, req.session.auth.username))
            return res.status(409).end();

        // Check if question was skipped
        if (!!survey.questions[q].required || a != null) {

            // 409 CONFLICT: Response isn't what we expect, indicating tomfoolery.
            if (q < 0 || q >= survey.questions.length)
                return res.status(409).end();

            if (!validate_response(survey.questions[q], a))
                return res.status(409).end();
        } else {
            a = 'NULL';
        }

        // Store results for vote from response
        await db.setResponse(survey, req.session.auth.username, req.session.auth.type, q, a);
        res.status(200).end();
    });

    // POST /vote/somevotename/complete
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

        req.session.survey_name = req.params.vote_name + '/results';

        // Handle if survey doesn't exist
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`))
            return genError(req, res, 404, 'Survey not found', 'The survey you have specified could not be found.');

        // Load the survey config
        var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8'));
        survey.path = req.path;
        survey.name = req.params.vote_name;

        if (!has_expired(survey) && !req.session.auth) {

            survey.responses = null;
            survey.auth_urls = [];
            survey.auth_types.forEach(function (auth_type) {
                survey.auth_urls.push(auth[auth_type].generate_url(req, res));
            });

            return res.status(200).render('pages/results', survey);
        }

        // Handle if user is not authorised
        if (!has_expired(survey) && !req.session.auth.is_mod)
            return genError(req, res, 401, 'Unauthorized', 'You are not authorized to access the results of this survey.');

        // Get results array for vote
        var responses = await db.getCompletedResponses(survey);

        survey.data = {}
        survey.questions.forEach(function (question, index) {
            survey.data[index] = [];
        });

        survey.responses = [];
        responses.forEach(function (response) {
            Object.entries(response).forEach(([key, value]) => {
                survey.data[key.slice(1)].push(value);
            });
            survey.responses.push(Object.values(response));
        });

        // survey.responses is an array of response onjects
        // response objects containing keys of format q{id}

        res.status(200).render('pages/results', survey);
    });

    // GET /vote/somevotename/config
    express.get('/vote/:vote_name/config', async (req, res) => {

        req.session.survey_name = req.params.vote_name + '/config';

        // Load the survey config
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`)) {
            var config = fs.readFileSync(`${__dirname}/surveys/sample.json`, 'utf-8');
        } else {
            var config = fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8');
        }

        var survey = JSON.parse(config);
        survey.path = req.path;
        survey.name = req.params.vote_name;

        if (authentication_enabled && !req.session.auth) {
            survey.config = null;
            survey.auth_urls = [];
            survey.auth_types.forEach(function (auth_type) {
                survey.auth_urls.push(auth[auth_type].generate_url(req, res));
            });
            return res.status(200).render('pages/config', survey);
        }

        // 401 UNAUTHORIZED: User hasn't gone through account verification
        if (!req.session.auth.is_mod || survey.auth_types.indexOf(req.session.auth.type) == -1)
            return genError(req, res, 401, 'Unauthorized', 'You are not authorized to access the configuration of this survey.');

        survey.config = config;
        survey.auth = req.session.auth;

        res.status(200).render('pages/config', survey);
    });

    // POST /vote/somevotename/update
    express.post('/vote/:vote_name/config/update', async (req, res) => {

        // 401 UNAUTHORIZED: User hasn't gone through account verification
        if ((authentication_enabled && !req.session.auth) || !req.session.auth.is_mod)
            return res.status(401).end();

        // Overwrite the JSON config
        fs.writeFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, JSON.stringify(req.body, null, 4), 'utf-8');

        // Get the survey
        var survey = req.body;
        survey.name = req.params.vote_name;

        // Update the database copy
        await db.deleteSurvey(survey);
        await db.createSurvey(survey);

        return res.status(200).end();

    });

    // DELETE /vote/somevotename/delete
    express.delete('/vote/:vote_name/config/delete', async (req, res) => {

        // 400 BAD REQUEST: Survey does not exist
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`))
            return res.status(400).end();

        // Get the survey
        var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8'));
        survey.name = req.params.vote_name;

        // 401 UNAUTHORIZED: User hasn't gone through account verification
        if ((authentication_enabled && !req.session.auth) || !req.session.auth.is_mod)
            return res.status(401).end();

        await db.deleteSurvey(survey);

        return res.status(200).end();

    });
};
