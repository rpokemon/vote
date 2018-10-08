const fs = require('fs');
const crypto = require('crypto');
const request = require('request');
const debug = require('debug')('routes');

const secrets = JSON.parse(fs.readFileSync(`${__dirname}/secrets.json`, 'utf-8'));

function genError(req, res, type, name, description) {
    var error = {};
    error.survey_name = `Error ${type}: ${name}`;
    error.survey_description = description;
    error.path = req.path;
    return res.status(type).render('pages/error', error);
}

module.exports = (express) => {

    // GET /vote/auth
    express.get('/vote/auth', (req, res) => {

        // Verify authentication state
        if (!req.session.state || req.session.state !== req.query.state)
            return genError(req, res, 500, 'Internal Server Error', 'An error has occured, please try again.');

        // Get information from reddit
        request.post('https://www.reddit.com/api/v1/access_token', {
            auth: {
                username: secrets.client_id,
                password: secrets.client_secret
            },
            body: `grant_type=authorization_code&code=${req.query.code}&redirect_uri=${secrets.redirect_uri}`
        }, function (error, response, body) {

            var token = JSON.parse(body).access_token;

            // Get client username
            request.get('https://oauth.reddit.com/api/v1/me', {
                auth: {
                    bearer: token
                },
                headers: {
                    'User-Agent': secrets.user_agent
                }
            }, function (error, response, body) {
                req.session.reddit_username = JSON.parse(body).name;

                // Check if client mods subreddit
                request.get({
                    url: 'https://oauth.reddit.com/subreddits/mine/moderator',
                    auth: {
                        bearer: token
                    },
                    headers: {
                        'User-Agent': secrets.user_agent
                    }
                }, function (error, response, body) {
                    req.session.is_mod = false;

                    for (var key in JSON.parse(body).data.children) {
                        subreddit = JSON.parse(body).data.children[key];
                        if (subreddit.data.url === '/r/pokemon/')
                            req.session.is_mod = true;
                    }

                    req.session.auth = true;

                    // Redirect to last survey
                    if (req.session.survey_name)
                        return res.redirect(`/vote/${req.session.survey_name}`);
                    else
                        return res.redirect('/');
                });
            });
        });
    });

    // GET /vote/somevotename
    express.get('/vote/:vote_name', (req, res) => {

        // Handle if survey doesn't exist
        if (!fs.existsSync(`${__dirname}/surveys/${req.params.vote_name}.json`))
            return genError(req, res, 404, 'Survey not found', 'The survey you have specified could not be found.');

        // Load the survey config
        var survey = JSON.parse(fs.readFileSync(`${__dirname}/surveys/${req.params.vote_name}.json`, 'utf-8'));
        survey.path = req.path;

        // Handle if the user is not logged in
        if (!req.session.auth) {
            req.session.survey_name = req.params.vote_name;
            req.session.state = crypto.randomBytes(20).toString('hex');

            survey.questions = null;
            survey.require_auth = true;
            survey.client_id = secrets.client_id;
            survey.auth_state = req.session.state;
            survey.redirect_uri = secrets.redirect_uri;

            return res.status(200).render('pages/vote', survey);
        }

        // Handle if user is not authorised
        if (!req.session.is_mod && survey.requires_mod)
            return genError(req, res, 401, 'Unauthorized', 'You are not authorized to access this survey.');

        // TODO: Handle if the user has already voted
        if (!true) {
            return genError(req, res, 403, 'Access Denied', 'You have already voted on this survey.');
        }

        survey.reddit_username = req.session.reddit_username

        res.status(200).render('pages/vote', survey);
    });

    // POST /vote/somevotename/response
    express.post('/vote/:vote_name/response', (req, res) => {

        // ignore any response where the user hasn't otherwise authenticated
        if (!req.session.auth)
            return res.status(401);

        // req.body will be an array
        var response = req.body;

        // TBD: response format

        // TODO: store results for vote from response

        res.status(200);
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
