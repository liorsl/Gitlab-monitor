const { EmbedBuilder, WebhookClient } = require('discord.js');
const { webhookToken, webhookID, gitlabToken, port } = require('./config.json');
const Gravatar = require('./utils/gravatar')
const path = require('path');
const express = require('express');

const webhookClient = new WebhookClient({ id: webhookID, token: webhookToken });
const app = express();

app.use(express.json());

function verifyGitLabWebhook(req, res, next) {
    const signature = req.get('X-Gitlab-Token');
	  if (signature !== gitlabToken)
	    return res.status(401).send('Unauthorized');
	  
    next();
}
  
app.post('/webhook', verifyGitLabWebhook, async (req, res) => {
    const payload = req.body;
    const objectKind = payload.object_kind;
    console.log(`Received GitLab event: ${objectKind}`);  
    
    try {
        const event = (objectKind === "tag_push" || objectKind === "push") ? "push_tag" : objectKind;
        const handlerPath = path.join(__dirname, 'endpoints', `${event.toLowerCase()}.js`);
        const { eventHandler } = require(handlerPath);
        
        const embedData = await eventHandler(payload); 

        const embed = new EmbedBuilder()
            .setAuthor({ name: embedData.username, iconURL: Gravatar.getGravatarUrl(embedData.email) })
            .setFooter({ text: payload.project.name })
            .setColor("#237feb")
            .setTimestamp()
            .setTitle(embedData.title)
            .setURL(embedData.url)

        if (embedData.fields && embedData.fields.length > 0)
            embed.setFields(embedData.fields);

        if (embedData.description && embedData.description.length > 0)
            embed.setDescription(embedData.description);

        await webhookClient.send({ embeds: [embed] });
        res.sendStatus(200);
    } catch (error) {
        console.error('Error handling GitLab event:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.listen(port, () => {
	console.log(`GitLab webhook receiver listening at port: ${port}`);
});
