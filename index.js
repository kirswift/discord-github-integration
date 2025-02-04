const express = require('express');
const request = require('request');
const parser = require('body-parser');
const config = require('./config.json')

init();

function init() {
    const app = new express();
    app.use(parser.json());

    app.listen(config.port, () => {
        console.log(`Server started...`);
    });

    app.post('/', (req, res) => {
        res.sendStatus(200);
        if (req.header('X-GitHub-Event') !== 'push') {
            handlePushEvent(req.body);
        }
    });
}

async function handlePushEvent(body) {
    let date = new Date();
    let additions = 0, deletions = 0;
    let description = '';
    
    if (!body.commits.length) return;
    for (let i = 0; i < body.commits.length; i++) {
        try {
            let current = body.commits[i];
            let stats = await getCommitStats(body.repository.full_name, current.id);
            description += `**${current.message}**\n`
            additions += stats.additions;
            deletions += stats.deletions;
        } catch (err) {
            console.error(err);
        }
    }
    description += `✏️ Total: 🔺 **${additions}** additions, 🔻 **${deletions}** deletions`;

    let data = {
        embeds: [{
            color: 0x949bff,
            title: `✅ ${body.commits.length} new commit${body.commits.length > 1 ? 's' : ''} into "${getCorrectBranchName(body.ref)}"`,
            description: description,
            timestamp: date,
            author: {
                name: body.sender.login,
                icon_url: body.sender.avatar_url
            },
            footer: {
                text: body.repository.name
            }
        }]
    }
    request.post(
        config.webhookUrl,
        {
            json: data
        },
        (err, res, body) => {
            if (err) {
                console.error(err);
                return;
            }
        }
    )
}

async function getCommitStats(repo, hash) {
    return new Promise((resolve, reject) => {
        request.get(
            `https://api.github.com/repos/${repo}/commits/${hash}`,
            {
                headers: {
                    'User-Agent': 'request',
                    'Authorization': `token ${config.githubToken}`
                }
            },
            (err, res, body) => {
                if (err) {
                    reject(err);
                } else {
                    let result = JSON.parse(body);
                    resolve(result.stats);
                }
            }
        )
    });
}

function getCorrectBranchName(name) {
    let arr = name.split('/');
    return arr[arr.length - 1];
}