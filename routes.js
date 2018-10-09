const fs = require('fs');
const debug = require('debug')('routes');

const auth = require('./auth.js')


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

        // TODO: Handle if the user has already voted
        if (!true) {
            return genError(req, res, 403, 'Access Denied', 'You have already voted on this survey.');
        }

        survey.auth = req.session.auth;

        res.status(200).render('pages/vote', survey);
    });


    // POST /vote/somevotename/response
    express.post('/vote/:vote_name/response', (req, res) => {

        // 401 UNAUTHORIZED: User hasn't gone through account verification
        if (!req.session.auth)
            return res.status(401).end();

        // 400 BAD REQUEST: Malformed or non-existent response, probably a UI-bug
        if (false)
            return res.status(400).end();

        // 409 CONFLICT: Response contains wrong number of questions or responses aren't what we expect, indicating tomfoolery.
        if (false)
            return res.status(409).end();

        // req.body.responses is an object containing keys of format q{id}
        // where id is the question number. values are in format:-
        // boolean: single string response
        // multi: array of string responses
        // numeric: single integer response
        // text: single string response, long form
        var response = req.body.responses;

        // TODO: store results for vote from response

        res.status(200).end();
    });


    // GET /vote/somevotename/results
    express.get('/vote/:vote_name/results', (req, res) => {

        var survey = {};

        // TODO: determine if authentication is required (e.g. for mod vote)

        // TODO: get results object for vote
        survey.survey_name = "some survey name";
        survey.survey_description = "some longform survey description";
        survey.path = req.path;

        // TBD: results object format
        res.status(200).render('pages/results', survey);
    });


};
