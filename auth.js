const crypto = require('crypto');
const fs = require('fs');

const request = require('request-promise');

const secrets = JSON.parse(fs.readFileSync(`${__dirname}/secrets.json`, 'utf-8'));

module.exports = {
    reddit: {
        authorize: async function (req, res) {

            var auth = {
                type: 'reddit'
            }
            var token = null;

            // Get information from reddit
            await request.post('https://www.reddit.com/api/v1/access_token', {
                auth: {
                    username: secrets.reddit.client_id,
                    password: secrets.reddit.client_secret
                },
                qs: {
                    grant_type: 'authorization_code',
                    code: req.query.code,
                    redirect_uri: secrets.reddit.redirect_uri
                }
            }, function (error, response, body) {

                token = JSON.parse(body).access_token;

            });

            // Get client username
            await request.get('https://oauth.reddit.com/api/v1/me', {
                auth: {
                    bearer: token
                },
                headers: {
                    'User-Agent': secrets.reddit.user_agent
                }
            }, function (error, response, body) {
                auth.username = `/u/${JSON.parse(body).name}`;

            });

            // Check if client mods subreddit
            await request.get({
                url: 'https://oauth.reddit.com/subreddits/mine/moderator',
                auth: {
                    bearer: token
                },
                headers: {
                    'User-Agent': secrets.reddit.user_agent
                }
            }, function (error, response, body) {
                auth.is_mod = false;

                var json = JSON.parse(body);

                for (var key in json.data.children) {
                    subreddit = json.data.children[key];
                    if (subreddit.data.url === '/r/pokemon/')
                        auth.is_mod = true;
                }
            });

            return auth;
        },
        generate_url: function (req, res) {
            req.session.reddit_state = crypto.randomBytes(20).toString('hex');
            return `https://www.reddit.com/api/v1/authorize?client_id=${secrets.reddit.client_id}&response_type=code&state=${req.session.reddit_state}&redirect_uri=${secrets.reddit.redirect_uri}&duratioon=temporary&scope=identity mysubreddits`;
        },
        validate: function (req, res) {
            return req.session.reddit_state && req.session.reddit_state === req.query.state;
        }
    },
    discord: {
        authorize: async function (req, res) {

            var auth = {
                type: 'discord'
            }
            var token = null;

            // Get information from discord
            await request.post('https://discordapp.com/api/v6/oauth2/token', {
                form: {
                    client_id: secrets.discord.client_id,
                    client_secret: secrets.discord.client_secret,
                    grant_type: 'authorization_code',
                    code: req.query.code,
                    redirect_uri: secrets.discord.redirect_uri,
                    scope: 'identify'
                },
            }, function (error, response, body) {
                token = JSON.parse(body).access_token;

            });

            console.log(token);

            // Get client username
            await request.get('https://discordapp.com/api/v6//users/@me', {
                auth: {
                    bearer: token
                }
            }, function (error, response, body) {
                user = JSON.parse(body);
                auth.username = `${user.username}#${user.discriminator}`;
            });

            auth.is_mod = false;
            return auth;

        },
        generate_url: function (req, res) {
            req.session.discord_state = crypto.randomBytes(20).toString('hex');
            return `https://discordapp.com/api/oauth2/authorize?client_id=${secrets.discord.client_id}&state=${req.session.discord_state}&redirect_uri=${secrets.discord.redirect_uri}&response_type=code&scope=identify`
        },
        validate: function (req, res) {
            return req.session.discord_state && req.session.discord_state === req.query.state;
        }
    }
}