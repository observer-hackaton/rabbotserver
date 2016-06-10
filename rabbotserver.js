var Botkit = require('botkit');
var os = require('os');
var amqp = require('amqplib/callback_api');
var amqpConn = null;
var http = require('http');

if (!process.env.RABBOTTSERVER_TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

var controller = Botkit.slackbot({
  debug: true,
});

var bot = controller.spawn({
  token: process.env.RABBOTTSERVER_TOKEN
}).startRTM(function(err,bot,payload) {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
});

controller.hears(['create (.*) (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
  var type = message.match[1];
  var host = message.match[2].match("<(.*)>")[1];

  bot.botkit.log('Monitor type', type);
  bot.botkit.log('Host', host);

  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  }, function(err, res) {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });

  create_monitor(type, host)
});

function create_monitor(type, host){
  var options = {
    host: process.env.RABBIT_MQ_SERVER,
    path: '/monitor',
    port: '8080',
    method: 'POST'};

    callback = function(response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });

      response.on('end', function () {
        console.log(str);
        bot.botkit.log('response:', str);
      });
    }

    var monitor = { monitor : { check : { type : type, interval : 60, arguments: "{ \"host\" : \"" + host + "\" }" }, notifier : { type : "slack", arguments : "{ \"webhook_url\" : \"https:\/\/hooks.slack.com\/services\/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\" }" } } };
    bot.botkit.log('response:', JSON.stringify(monitor));

    var req = http.request(options, callback);
    //This is the data we are posting, it needs to be a string or a buffer
    req.write(JSON.stringify(monitor));
    req.end();
  }

  function start_connection() {
    amqp.connect('amqp://' + process.env.RABBIT_MQ_SERVER, function(err, conn) {
      conn.createChannel(function(err, ch) {
        var exch = 'checks'
        var q = type;
        var msg = 'Hello World!';

        ch.assertQueue(q, {durable: false});
        ch.sendToQueue(q, new Buffer(msg));
        console.log(" [x] Sent %s", msg);
      });
      setTimeout(function() { conn.close(); process.exit(0) }, 500);
    });
  }
